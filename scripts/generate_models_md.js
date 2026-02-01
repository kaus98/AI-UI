const fs = require('fs');
const path = require('path');

const modelsPath = path.join(__dirname, '../data/models.json');
const outputPath = path.join(__dirname, '../models.md');

try {
    const rawData = fs.readFileSync(modelsPath, 'utf8');
    const modelsData = JSON.parse(rawData);

    let allModels = [];

    // Iterate over all endpoint snapshots
    Object.values(modelsData).forEach(modelsList => {
        if (Array.isArray(modelsList)) {
            modelsList.forEach(model => {
                // Deduplicate by ID if necessary, or just list all. 
                // Let's list all unique IDs.
                if (!allModels.find(m => m.id === model.id)) {
                    allModels.push(model);
                }
            });
        }
    });

    // Sort by owner then ID
    allModels.sort((a, b) => {
        const ownerA = (a.owned_by || '').toLowerCase();
        const ownerB = (b.owned_by || '').toLowerCase();
        if (ownerA < ownerB) return -1;
        if (ownerA > ownerB) return 1;
        return a.id.localeCompare(b.id);
    });

    let markdown = '# AI Models Documentation\n\n';
    markdown += `Generated on: ${new Date().toISOString()}\n\n`;

    markdown += '| Model Name | ID | Company | Context | Output | Vision | Audio | Released | Pricing (In/Out per M) |\n';
    markdown += '| :--- | :--- | :--- | :--- | :--- | :---: | :---: | :---: | :--- |\n';

    allModels.forEach(m => {
        const name = m.display_name || m.id;
        const id = m.id;
        const company = m.owned_by || '-';
        const context = m.context_length ? m.context_length.toLocaleString() : '-';
        const output = m.max_output_tokens ? m.max_output_tokens.toLocaleString() : '-';

        let vision = '-';
        if (m.capabilities && m.capabilities.supports_vision) vision = '✅';
        else if (id.toLowerCase().includes('vision') || id.toLowerCase().includes('gpt-4o')) vision = '✅ (inferred)';

        let audio = '-';
        if (m.capabilities && m.capabilities.supports_audio) audio = '✅';
        else if (id.toLowerCase().includes('audio') || id.toLowerCase().includes('whisper')) audio = '✅ (inferred)';

        let released = '-';
        if (m.created) {
            // Check if created is seconds or milliseconds
            const date = new Date(m.created > 10000000000 ? m.created : m.created * 1000);
            if (!isNaN(date.getTime())) released = date.getFullYear();
        } else if (m.created_at) {
            const date = new Date(m.created_at);
            if (!isNaN(date.getTime())) released = date.getFullYear();
        }

        let pricing = '-';
        if (m.pricing) {
            const cur = m.pricing.currency || '$';
            const input = m.pricing.input_tokens_cost_per_million;
            const outputCost = m.pricing.output_tokens_cost_per_million;
            if (input !== undefined && outputCost !== undefined) {
                pricing = `${cur}${input} / ${cur}${outputCost}`;
            }
        }

        markdown += `| ${name} | \`${id}\` | ${company} | ${context} | ${output} | ${vision} | ${audio} | ${released} | ${pricing} |\n`;
    });

    markdown += '\n\n## Raw Details\n\nFor full JSON details, refer to `data/models.json`.\n';

    fs.writeFileSync(outputPath, markdown);
    console.log(`Successfully generated models.md at ${outputPath} with ${allModels.length} models.`);

} catch (error) {
    console.error('Error generating documentation:', error);
    process.exit(1);
}
