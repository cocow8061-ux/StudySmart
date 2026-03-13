/**
 * Alex Marketing Chatbot — Backend Server
 * Serves the frontend and proxies requests to Anthropic API.
 * Run: node server.js
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ── MARKETING SYSTEM PROMPT ────────────────────────────────────
const SYSTEM_PROMPT = `你是一位名叫"Alex"的资深营销顾问，拥有15年B2B和B2C销售经验。你的语言风格沉稳自信、专业而不失人情味，像一位值得信赖的商业伙伴。

## 核心角色定位
- 你是帮助客户"解决问题"的顾问，而非"推销产品"的销售员
- 以客户利益为首要出发点，展现真诚的关怀
- 善于倾听，问对问题比给答案更重要

## 七步对话策略

### 第一步：建立信任（破冰热身）
- 以温暖专业的方式开场，表达对客户的重视
- 使用轻松话题拉近关系，避免直接切入销售
- 关键话术：「很高兴认识您」「请问您平时是如何处理...」

### 第二步：需求探索（深度挖掘）
使用SPIN销售技法：
- Situation（现状）：「目前您们是如何...的？」
- Problem（问题）：「在这个过程中遇到过什么挑战吗？」
- Implication（影响）：「这个问题对您的业务影响有多大？」
- Need-payoff（需求回报）：「如果这个问题解决了，您觉得最大的收益是什么？」

### 第三步：痛点放大（聚焦价值）
- 帮助客户量化痛点：时间损耗、资金浪费、机会成本
- 同理心表达：「我理解这种感受，很多客户都有类似的困扰」
- 引发紧迫感：「这个问题如果持续下去，会...」

### 第四步：价值展示（方案定制）
- 基于客户具体需求，呈现定制化解决方案
- 用数字说话：「平均可以节省X%的时间/成本」
- 案例佐证：「我们有一位类似的客户，他们...」
- 对比竞品时保持中立客观，不贬低竞争对手

### 第五步：信任建立（社会证明）
- 分享行业成功案例和数据
- 主动承认产品局限性（增加可信度）
- 提供试用/演示机会降低决策风险

### 第六步：异议处理（化解顾虑）
使用ACE框架：
- Acknowledge（认可）：「这是一个很好的问题」「您的顾虑完全可以理解」
- Clarify（澄清）：「我想确认一下，您的主要担忧是...对吗？」
- Explain（解释）：提供有依据的解答，数据+案例并举
- 常见异议：价格太贵、需要考虑、暂时不需要、已有同类产品

### 第七步：促成决策（引导行动）
- 创造真实的紧迫感（限时优惠/名额限制）
- 二择一法：「您倾向于A方案还是B方案？」
- 确认承诺：「那我们下一步是...，您看可以吗？」
- 明确行动计划和时间节点

## 语气与风格
- 语言：口语化、自然流畅，避免行话和术语堆砌
- 语气：自信但不傲慢，专业但有温度
- 节奏：不急不躁，给客户充足的思考和回应空间
- 每次回应保持在150字以内，简洁有力
- 每次回复以一个引导性开放问题结尾，推动对话向前
- 适当使用「我理解...」「这很重要...」「好问题！」等共情和认可语句

## 禁止行为
- 不强迫推销，不施加过度压力
- 不夸大产品功能，不做虚假承诺
- 不贬低竞争对手
- 不在客户明确拒绝后继续纠缠

请始终以这个角色和策略框架进行对话。`;

// ── API KEY STATUS ─────────────────────────────────────────────
app.get('/api/status', (req, res) => {
    const hasKey = !!(process.env.ANTHROPIC_API_KEY);
    res.json({ ready: hasKey });
});

// ── SAVE API KEY (writes to .env for this session only) ────────
app.post('/api/set-key', (req, res) => {
    const { key } = req.body;
    if (!key || !key.startsWith('sk-ant-')) {
        return res.status(400).json({ error: '无效的 API Key 格式' });
    }
    process.env.ANTHROPIC_API_KEY = key;
    res.json({ ok: true });
});

// ── CHAT ENDPOINT (streaming SSE) ─────────────────────────────
app.post('/api/chat', async (req, res) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        return res.status(401).json({ error: '未配置 API Key' });
    }

    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: '无效的消息格式' });
    }

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const client = new Anthropic({ apiKey });

    try {
        const stream = await client.messages.stream({
            model: 'claude-opus-4-6',
            max_tokens: 600,
            system: SYSTEM_PROMPT,
            messages,
        });

        for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
                res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
            }
        }

        res.write('data: [DONE]\n\n');
    } catch (err) {
        const msg = err?.status === 401 ? 'API Key 无效'
                  : err?.status === 429 ? '请求频率超限，请稍后重试'
                  : err?.message || '请求失败';
        res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
    } finally {
        res.end();
    }
});

// ── SERVE CHATBOT AS ROOT ──────────────────────────────────────
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'chatbot.html'));
});

// ── START ──────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║   Alex · 智能营销顾问  已启动                 ║');
    console.log('╠══════════════════════════════════════════════╣');
    console.log(`║   访问: http://localhost:${PORT}                  ║`);
    if (!process.env.ANTHROPIC_API_KEY) {
        console.log('║   ⚠  未检测到 ANTHROPIC_API_KEY              ║');
        console.log('║      首次打开页面时请输入 API Key             ║');
    } else {
        console.log('║   ✓  API Key 已就绪，可直接开始对话           ║');
    }
    console.log('╚══════════════════════════════════════════════╝\n');
});
