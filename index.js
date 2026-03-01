const fs = require('fs');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const USERNAME = 'Lucas-Sabino01';

const headers = {
    'Authorization': `token ${GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json'
};

async function fetchFromGitHub(endpoint) {
    try {
        const res = await fetch(`https://api.github.com${endpoint}`, { headers });
        if (!res.ok) throw new Error(`Erro API GitHub: ${res.status}`);
        return await res.json();
    } catch (error) {
        console.error(`Falha ao buscar ${endpoint}:`, error);
        return null;
    }
}

async function fetchGitHubStats() {
    console.log("A buscar dados do perfil...");
    
    const events = await fetchFromGitHub(`/users/${USERNAME}/events/public`) || [];
    const now = new Date();
    const yesterday = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    const pushEvents = Array.isArray(events) ? events.filter(e => e.type === 'PushEvent' && new Date(e.created_at) > yesterday) : [];
    const commitsToday = pushEvents.reduce((acc, event) => acc + (event.payload.commits?.length || 0), 0);
    const reposTouched = [...new Set(pushEvents.map(e => e.repo.name))];

    const repos = await fetchFromGitHub(`/users/${USERNAME}/repos?per_page=100`) || [];
    let totalStars = 0;
    let langMap = {};
    
    if (Array.isArray(repos)) {
        repos.forEach(r => {
            totalStars += r.stargazers_count;
            if (r.language && r.size) {
                langMap[r.language] = (langMap[r.language] || 0) + r.size;
            }
        });
    }

    const totalSize = Object.values(langMap).reduce((a, b) => a + b, 0);
    const sortedLangs = Object.entries(langMap).sort((a, b) => b[1] - a[1]);
    const top3Langs = sortedLangs.slice(0, 3).map(l => ({
        name: l[0],
        percent: totalSize > 0 ? Math.round((l[1] / totalSize) * 100) : 0
    }));
    while(top3Langs.length < 3) top3Langs.push({ name: '-', percent: 0 });

    const issuesData = await fetchFromGitHub(`/search/issues?q=author:${USERNAME}+type:issue`);
    const prsData = await fetchFromGitHub(`/search/issues?q=author:${USERNAME}+type:pr`);
    const commitsData = await fetchFromGitHub(`/search/commits?q=author:${USERNAME}`);

    const totalIssues = issuesData?.total_count || 0;
    const totalPRs = prsData?.total_count || 0;
    const totalContribs = commitsData?.total_count || 0;

    let topLanguage = top3Langs[0].name !== '-' ? top3Langs[0].name : 'React / C#';
    let energyLevel = 'Alto 🚀';
    
    if (commitsToday === 0) {
        topLanguage = 'Planejamento e Café ☕';
        energyLevel = 'Recarregando 🔋';
    }

    return {
        commitsToday,
        reposTouched,
        topLanguage,
        energyLevel,
        top3Langs,
        totalStars,
        totalIssues,
        totalPRs,
        totalContribs
    };
}

async function generateAIResponse(stats) {
    console.log("A solicitar resumo à IA...");
    let prompt = '';

    if (stats.commitsToday === 0) {
        prompt = `
        Você é uma IA analisando o perfil do engenheiro de software Lucas Sabino.
        Hoje ele não fez commits públicos. 
        Escreva um parágrafo curto de no máximo 2 frases, com humor inteligente, deduzindo que ele deve estar focando em estudar novas arquiteturas, documentando o WMS TecnoTooling-ALFA ou recarregando as baterias. 
        Use no máximo 2 emojis. Fale em português do Brasil na terceira pessoa ("O Lucas..."). Evite usar o caractere "&". Seja muito conciso.
        `;
    } else {
        prompt = `
        Você é uma IA analisando o perfil do engenheiro de software Lucas Sabino.
        Hoje ele fez ${stats.commitsToday} commits nos repositórios: ${stats.reposTouched.join(', ')}.
        Escreva um parágrafo curto de no máximo 2 frases elogiando a consistência dele e o foco em código limpo.
        Use no máximo 2 emojis. Fale em português do Brasil na terceira pessoa ("O Lucas..."). Evite usar o caractere "&". Seja muito conciso.
        `;
    }

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await response.json();
        return data.candidates[0].content.parts[0].text.trim();
    } catch (e) {
        console.error("Erro na IA:", e);
        return "A IA está em manutenção de rotina, mas o código não para! O Lucas continua focando em arquitetura e entregas sólidas hoje. 🚀💻";
    }
}

async function main() {
    try {
        const stats = await fetchGitHubStats();
        const aiMessage = await generateAIResponse(stats);

        const safeAiMessage = aiMessage
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        let svgTemplate = fs.readFileSync('template.svg', 'utf-8');
        
        const date = new Date().toLocaleDateString('pt-BR', { 
            day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Sao_Paulo'
        });
        
        svgTemplate = svgTemplate
            .replace('{{AI_SUMMARY}}', safeAiMessage)
            .replace('{{COMMITS_TODAY}}', stats.commitsToday.toString())
            .replace('{{TOP_LANGUAGE}}', stats.topLanguage)
            .replace('{{ENERGY_LEVEL}}', stats.energyLevel) 
            .replace('{{DATE}}', date);

        svgTemplate = svgTemplate
            .replace('{{TOTAL_STARS}}', stats.totalStars.toString())
            .replace('{{TOTAL_ISSUES}}', stats.totalIssues.toString())
            .replace('{{TOTAL_PRS}}', stats.totalPRs.toString())
            .replace('{{CONTRIBS}}', stats.totalContribs.toString());

        stats.top3Langs.forEach((lang, index) => {
            const num = index + 1;
            const nameRegex = new RegExp(`{{LANG_${num}_NAME}}`, 'g');
            const percentRegex = new RegExp(`{{LANG_${num}_PERCENT}}`, 'g');
            
            svgTemplate = svgTemplate
                .replace(nameRegex, lang.name)
                .replace(percentRegex, lang.percent.toString());
        });

        fs.writeFileSync('ai-status-widget.svg', svgTemplate);
        console.log("Widget gerado com sucesso! 🎉");
    } catch (error) {
        console.error('Erro Critico:', error);
        process.exit(1);
    }
}

main();