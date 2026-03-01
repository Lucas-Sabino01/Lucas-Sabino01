import fs from 'fs';

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
    const pushEvents = events.filter(e => e.type === 'PushEvent');
    const todayCommits = pushEvents.reduce((acc, event) => acc + event.payload.commits.length, 0);
    const reposTouched = [...new Set(pushEvents.map(e => e.repo.name))];

    return {
        commits: todayCommits,
        repos: reposTouched,
        topLanguage: 'React / C#' 
    };
}

async function generateAIResponse(stats) {
    const prompt = `
    Você é uma IA monitorando o perfil do engenheiro de software Lucas Sabino.
    Hoje ele fez ${stats.commits} commits nos repositórios: ${stats.repos.join(', ')}.
    Escreva um parágrafo de 3 linhas, profissional e descontraído, resumindo o dia dele.
    Use no máximo 2 emojis. Fale em português do Brasil. Fale na terceira pessoa ("O Lucas...").
    `;

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
        
        // Ajusta a data para o fuso horário do Brasil
        const date = new Date().toLocaleDateString('pt-BR', { 
            day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Sao_Paulo'
        });
        
        svgTemplate = svgTemplate
            .replace('{{AI_SUMMARY}}', aiMessage)
            .replace('{{COMMITS_TODAY}}', stats.commits.toString())
            .replace('{{TOP_LANGUAGE}}', stats.topLanguage)
            .replace('{{DATE}}', date);

        fs.writeFileSync('ai-status-widget.svg', svgTemplate);
    } catch (error) {
        console.error('Erro:', error);
        process.exit(1);
    }
}

main();