"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.needsResponsesApi = needsResponsesApi;
exports.convertChatRequestToResponses = convertChatRequestToResponses;
exports.streamResponsesAsChatChunks = streamResponsesAsChatChunks;
exports.createResponsesAsChatCompletion = createResponsesAsChatCompletion;

/** GPT-6.x / recent reasoning models require Responses API for tool calling. */
function needsResponsesApi(model, openaiRequest) {
    const m = String(model || '');
    const hasTools = Array.isArray(openaiRequest?.tools) && openaiRequest.tools.length > 0;
    if (!hasTools) return false;
    return /^(gpt-6(\.|$)|gpt-5\.|o3|o4)/i.test(m);
}

function flattenContent(content) {
    if (content == null) return '';
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
        return content.map((part) => {
            if (typeof part === 'string') return part;
            if (part?.type === 'text') return part.text || '';
            if (part?.type === 'image_url') return ''; // images handled separately below
            return '';
        }).join('');
    }
    return String(content);
}

function toUserContentParts(content) {
    if (content == null) return [{ type: 'input_text', text: '' }];
    if (typeof content === 'string') return [{ type: 'input_text', text: content }];
    if (!Array.isArray(content)) return [{ type: 'input_text', text: String(content) }];
    const parts = [];
    for (const part of content) {
        if (typeof part === 'string') {
            parts.push({ type: 'input_text', text: part });
        } else if (part?.type === 'text') {
            parts.push({ type: 'input_text', text: part.text || '' });
        } else if (part?.type === 'image_url') {
            const url = part.image_url?.url || part.image_url;
            if (url) parts.push({ type: 'input_image', image_url: url });
        }
    }
    return parts.length ? parts : [{ type: 'input_text', text: '' }];
}

function convertMessagesToInput(messages) {
    const input = [];
    for (const msg of messages || []) {
        if (!msg || !msg.role) continue;
        if (msg.role === 'system' || msg.role === 'developer') {
            input.push({
                role: 'developer',
                content: flattenContent(msg.content),
            });
            continue;
        }
        if (msg.role === 'user') {
            input.push({
                role: 'user',
                content: toUserContentParts(msg.content),
            });
            continue;
        }
        if (msg.role === 'assistant') {
            const text = flattenContent(msg.content);
            if (text) {
                input.push({ role: 'assistant', content: text });
            }
            if (Array.isArray(msg.tool_calls)) {
                for (const tc of msg.tool_calls) {
                    input.push({
                        type: 'function_call',
                        call_id: tc.id,
                        name: tc.function?.name || tc.name || '',
                        arguments: tc.function?.arguments || tc.arguments || '{}',
                    });
                }
            }
            continue;
        }
        if (msg.role === 'tool') {
            input.push({
                type: 'function_call_output',
                call_id: msg.tool_call_id,
                output: flattenContent(msg.content),
            });
        }
    }
    return input;
}

function convertTools(tools) {
    return (tools || []).map((t) => {
        if (t.type === 'function' && t.function) {
            return {
                type: 'function',
                name: t.function.name,
                description: t.function.description,
                parameters: t.function.parameters,
            };
        }
        // already responses-shaped
        return t;
    });
}

function convertToolChoice(toolChoice) {
    if (!toolChoice || toolChoice === 'auto' || toolChoice === 'none' || toolChoice === 'required') {
        return toolChoice || 'auto';
    }
    if (toolChoice.type === 'function') {
        const name = toolChoice.function?.name || toolChoice.name;
        if (name) return { type: 'function', name };
    }
    return 'auto';
}

function mapEffort(effort) {
    const e = String(effort || 'low').toLowerCase();
    if (e === 'none' || e === 'minimal') return 'low';
    if (['low', 'medium', 'high', 'xhigh'].includes(e)) return e;
    return 'low';
}

function convertChatRequestToResponses(openaiRequest, effort = 'low') {
    const body = {
        model: openaiRequest.model,
        input: convertMessagesToInput(openaiRequest.messages),
        tools: convertTools(openaiRequest.tools),
        tool_choice: convertToolChoice(openaiRequest.tool_choice),
        reasoning: { effort: mapEffort(effort || openaiRequest.reasoning_effort) },
        store: false,
    };
    const maxTokens = openaiRequest.max_completion_tokens || openaiRequest.max_tokens;
    if (maxTokens) body.max_output_tokens = maxTokens;
    // Drop empty tools
    if (!body.tools?.length) delete body.tools;
    return body;
}

function chatChunk({ model, content, toolCalls, finishReason, usage }) {
    return {
        id: `chatcmpl_resp_${Date.now().toString(36)}`,
        object: 'chat.completion.chunk',
        model: model || '',
        choices: [{
            index: 0,
            delta: {
                ...(content != null ? { content } : {}),
                ...(toolCalls ? { tool_calls: toolCalls } : {}),
            },
            finish_reason: finishReason || null,
        }],
        ...(usage ? { usage } : {}),
    };
}

function usageFromResponse(usage) {
    if (!usage) return undefined;
    return {
        prompt_tokens: usage.input_tokens || 0,
        completion_tokens: usage.output_tokens || 0,
        total_tokens: usage.total_tokens || 0,
        prompt_tokens_details: {
            cached_tokens: usage.input_tokens_details?.cached_tokens || 0,
        },
    };
}

/**
 * Async generator yielding chat.completion-compatible chunks from a Responses stream.
 */
async function* streamResponsesAsChatChunks(openai, responsesBody) {
    const stream = await openai.responses.create({ ...responsesBody, stream: true });
    const toolIndexByOutputIndex = new Map();
    let nextToolIndex = 0;
    let model = responsesBody.model;
    let sawToolCall = false;

    for await (const event of stream) {
        const type = event?.type;
        if (type === 'response.created' || type === 'response.in_progress') {
            if (event.response?.model) model = event.response.model;
            continue;
        }
        if (type === 'response.output_text.delta' || type === 'response.text.delta') {
            yield chatChunk({ model, content: event.delta || '' });
            continue;
        }
        if (type === 'response.output_item.added') {
            const item = event.item;
            if (item?.type === 'function_call') {
                const idx = nextToolIndex++;
                toolIndexByOutputIndex.set(event.output_index, idx);
                sawToolCall = true;
                yield chatChunk({
                    model,
                    toolCalls: [{
                        index: idx,
                        id: item.call_id || item.id,
                        type: 'function',
                        function: { name: item.name || '', arguments: '' },
                    }],
                });
            }
            continue;
        }
        if (type === 'response.function_call_arguments.delta') {
            const idx = toolIndexByOutputIndex.has(event.output_index)
                ? toolIndexByOutputIndex.get(event.output_index)
                : 0;
            yield chatChunk({
                model,
                toolCalls: [{
                    index: idx,
                    type: 'function',
                    function: { arguments: event.delta || '' },
                }],
            });
            continue;
        }
        if (type === 'response.completed' || type === 'response.incomplete') {
            const usage = usageFromResponse(event.response?.usage);
            yield chatChunk({
                model: event.response?.model || model,
                finishReason: sawToolCall ? 'tool_calls' : 'stop',
                usage,
            });
            continue;
        }
        if (type === 'response.failed' || type === 'error' || type === 'response.error') {
            const msg = event.error?.message || event.message || 'Responses API request failed';
            throw new Error(msg);
        }
    }
}

async function createResponsesAsChatCompletion(openai, responsesBody) {
    const response = await openai.responses.create({ ...responsesBody, stream: false });
    const model = response.model || responsesBody.model;
    let content = '';
    const toolCalls = [];
    for (const item of response.output || []) {
        if (item.type === 'message') {
            for (const part of item.content || []) {
                if (part.type === 'output_text') content += part.text || '';
            }
        } else if (item.type === 'function_call') {
            toolCalls.push({
                id: item.call_id || item.id,
                type: 'function',
                function: {
                    name: item.name,
                    arguments: item.arguments || '{}',
                },
            });
        }
    }
    return {
        id: response.id || `chatcmpl_resp_${Date.now().toString(36)}`,
        object: 'chat.completion',
        model,
        choices: [{
            index: 0,
            message: {
                role: 'assistant',
                content: content || null,
                ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
            },
            finish_reason: toolCalls.length ? 'tool_calls' : 'stop',
        }],
        usage: usageFromResponse(response.usage) || {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0,
        },
    };
}
