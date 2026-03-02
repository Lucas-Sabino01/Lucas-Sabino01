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
    console.log("A procurar dados do perfil...");
    
    const events = await fetchFromGitHub(`/users/${USERNAME}/events`) || [];

    const now = new Date();
    const yesterday = new Date(now.getTime() - (24 * 60 * 60 * 1000));

    const pushEvents = Array.isArray(events) ? events.filter(e => {
        return e.type === 'PushEvent' && new Date(e.created_at) > yesterday;
    }) : [];

    const commitsToday = pushEvents.reduce((acc, event) => acc + (event.payload.commits?.length || 0), 0);
    
    const reposTouched = [...new Set(pushEvents.map(e => e.public ? e.repo.name : 'um projeto confidencial'))];

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
    
    const contextRules = `
    Informações globais do perfil do Lucas para você usar como contexto e criar respostas originais:
    - Linguagens mais usadas (Top 3): ${stats.top3Langs.map(l => l.name).join(', ')}.
    - Total de estrelas em projetos: ${stats.totalStars}.
    - Total de PRs (Pull Requests): ${stats.totalPRs}.
    - Total de Issues: ${stats.totalIssues}.
    - Contribuições globais na vida: ${stats.totalContribs}.
    `;

    let prompt = '';

    if (stats.commitsToday === 0) {
        prompt = `
        Aja como um narrador criativo, elogiando o perfil do dev Lucas Sabino.
        Dados REAIS do perfil para embasar seu elogio:
        ${contextRules}
        
        Aviso sobre as últimas 24h: Ele não fez commits públicos.
        
        Sua tarefa: Escreva um parágrafo curto (até 2 frases) para o widget do GitHub.
        Assuma com bom humor que ele está explorando tecnologias nos bastidores, criando algo em secreto com sua linguagem favorita (${stats.topLanguage}), ou recarregando as baterias.
        
        REGRAS IMPORTANTES:
        - NUNCA repita ou cite palavras do meu prompt como "Aviso sobre" ou "Situação".
        - Fale em português (BR) na terceira pessoa ("O Lucas...").
        - Use os dados do perfil (ex: PRs, estrelas, contribuições) de forma 100% fluida e natural.
        - Use 1 ou 2 emojis no máximo. Evite "&".
        `;
    } else {
        prompt = `
        Aja como um narrador entusiasmado, orgulhoso do trabalho do dev Lucas Sabino.
        Dados REAIS do perfil:
        ${contextRules}
        
        Aviso sobre as últimas 24h: Ele fez ${stats.commitsToday} commits nos repositórios: ${stats.reposTouched.join(', ')}.
        
        Sua tarefa: Escreva um parágrafo curto (até 2 frases) para o widget do GitHub.
        Elogie a consistência da entrega de código. Misture isso de forma orgânica com os dados do perfil (ex: número de PRs, ${stats.totalStars} estrelas conquistadas ou top linguagens).
        
        REGRAS IMPORTANTES:
        - NUNCA repita ou liste palavras deste prompt (NUNCA diga coisas como "Aviso sobre", "Situação").
        - Fale em português (BR) na terceira pessoa ("O Lucas...").
        - O texto deve soar incrivelmente humano, animado e natural.
        - Use 1 ou 2 emojis no máximo. Evite "&".
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