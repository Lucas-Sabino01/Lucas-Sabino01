const fs = require('fs');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const USERNAME = 'Lucas-Sabino01';

async function fetchGitHubStats() {
    const response = await fetch(`https://api.github.com/users/${USERNAME}/events/public`, {
        headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json'
        }
    });
    
    const events = await response.json();
    
    if (!Array.isArray(events)) {
        console.error("Resposta inesperada do GitHub:", events);
        return { commits: 0, repos: [], topLanguage: 'Planejamento & Café ☕', energyLevel: 'Recarregando 🔋' };
    }
    const now = new Date();
    const yesterday = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    
    const pushEvents = events.filter(e => e.type === 'PushEvent' && new Date(e.created_at) > yesterday);
    
    const commits = pushEvents.reduce((acc, event) => acc + (event.payload.commits?.length || 0), 0);
    
    const reposTouched = [...new Set(pushEvents.map(e => e.repo.name))];

    let topLanguage = 'React / C#';
    let energyLevel = 'Alto 🚀';
    
    if (commits === 0) {
        topLanguage = 'Planejamento & Café ☕';
        energyLevel = 'Recarregando 🔋';
    }

    return {
        commits: commits,
        repos: reposTouched,
        topLanguage: topLanguage,
        energyLevel: energyLevel
    };
}

async function generateAIResponse(stats) {
    let prompt = '';

    if (stats.commits === 0) {
        prompt = `
        Você é uma IA de monitoramento de código analisando o perfil do engenheiro de software Lucas Sabino.
        Hoje ele não fez commits públicos. 
        Escreva um parágrafo de 3 linhas, com humor inteligente, dizendo que pausas são importantes e deduzindo que ele deve estar focando em estudar novas arquiteturas, documentando o WMS TecnoTooling-ALFA ou apenas recarregando as baterias. 
        Use no máximo 2 emojis. Fale em português do Brasil na terceira pessoa ("O Lucas...").
        `;
    } else {
        prompt = `
        Você é uma IA de monitoramento de código analisando o perfil do engenheiro de software Lucas Sabino.
        Hoje ele fez ${stats.commits} commits nos repositórios: ${stats.repos.join(', ')}.
        Escreva um parágrafo de 3 linhas, profissional e descontraído, elogiando a consistência dele.
        Use no máximo 2 emojis. Fale em português do Brasil na terceira pessoa ("O Lucas...").
        `;
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    const data = await response.json();
    return data.candidates[0].content.parts[0].text.trim();
}

async function main() {
    try {
        const stats = await fetchGitHubStats();
        const aiMessage = await generateAIResponse(stats);

        let svgTemplate = fs.readFileSync('template.svg', 'utf-8');
        
        const date = new Date().toLocaleDateString('pt-BR', { 
            day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Sao_Paulo'
        });
        
        svgTemplate = svgTemplate
            .replace('{{AI_SUMMARY}}', aiMessage)
            .replace('{{COMMITS_TODAY}}', stats.commits.toString())
            .replace('{{TOP_LANGUAGE}}', stats.topLanguage)
            .replace('Alto 🚀', stats.energyLevel) 
            .replace('{{DATE}}', date);

        fs.writeFileSync('ai-status-widget.svg', svgTemplate);
    } catch (error) {
        console.error('Erro:', error);
        process.exit(1);
    }
}

main();