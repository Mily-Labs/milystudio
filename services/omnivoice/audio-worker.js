const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// 1. Р—Р°РіСЂСѓР·РєР° РєРѕРЅС„РёРіСѓСЂР°С†РёРё .env
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)?\s*$/);
        if (match) {
            const key = match[1];
            let value = match[2] || '';
            if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
            else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
            process.env[key] = value;
        }
    });
}

// 2. РџСЂРѕРІРµСЂРєР° РЅР°СЃС‚СЂРѕРµРє
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const POLLING_INTERVAL = 60000; // 1 РјРёРЅСѓС‚Р°

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[РљР РРўРР§Р•РЎРљРђРЇ РћРЁРР‘РљРђ] РќРµ РЅР°Р№РґРµРЅС‹ РїРµСЂРµРјРµРЅРЅС‹Рµ РѕРєСЂСѓР¶РµРЅРёСЏ SUPABASE_URL РёР»Рё SUPABASE_SERVICE_KEY. РџСЂРѕРІРµСЂСЊС‚Рµ .env С„Р°Р№Р».');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

console.log('===================================================');
console.log('   POLITICAL NEWS AUDIO WORKER Р—РђРџРЈР©Р•Рќ');
console.log('===================================================');

async function processPoliticalNews() {
    console.log(`\n[${new Date().toLocaleTimeString()}] РџСЂРѕРІРµСЂРєР° РЅРѕРІС‹С… Р·Р°РїРёСЃРµР№ РІ political_news...`);

    // РС‰РµРј Р·Р°РїРёСЃРё, РіРґРµ audio != 'TRUE' (РІРєР»СЋС‡Р°СЏ NULL).
    // РСЃРїРѕР»СЊР·СѓРµРј .or РґР»СЏ РїСЂРѕРІРµСЂРєРё NULL РёР»Рё РЅРµ 'TRUE'
    const { data: rows, error } = await supabase
        .from('political_news')
        .select('*')
        .or('audio.neq.TRUE,audio.is.null');

    if (error) {
        console.error('[РћРЁРР‘РљРђ] РќРµ СѓРґР°Р»РѕСЃСЊ РїРѕР»СѓС‡РёС‚СЊ РґР°РЅРЅС‹Рµ РёР· political_news:', error);
        setTimeout(processPoliticalNews, POLLING_INTERVAL);
        return;
    }

    if (!rows || rows.length === 0) {
        console.log('[РРќР¤Рћ] РќРµС‚ РЅРѕРІС‹С… Р·Р°РїРёСЃРµР№ РґР»СЏ РѕР±СЂР°Р±РѕС‚РєРё.');
    } else {
        console.log(`[РРќР¤Рћ] РќР°Р№РґРµРЅРѕ Р·Р°РїРёСЃРµР№ РґР»СЏ РѕР±СЂР°Р±РѕС‚РєРё: ${rows.length}`);
        for (const row of rows) {
            await processRow(row);
        }
    }

    setTimeout(processPoliticalNews, POLLING_INTERVAL);
}

async function processRow(row) {
    const { id, generation_date, important_events, unnoticed_news, independent_analysis } = row;

    if (!generation_date) {
        console.error(`[SKIP] РџСЂРѕРїСѓСЃРє СЃС‚СЂРѕРєРё ID ${id}: РѕС‚СЃСѓС‚СЃС‚РІСѓРµС‚ generation_date`);
        return;
    }

    // РР·РІР»РµРєР°РµРј С‚РѕР»СЊРєРѕ РґР°С‚Сѓ YYYY-MM-DD
    const folderDate = generation_date.split(' ')[0].split('T')[0];

    console.log(`>>> РћР±СЂР°Р±РѕС‚РєР° Р·Р°РїРёСЃРё ID: ${id}, Р”Р°С‚Р° РіРµРЅРµСЂР°С†РёРё: ${generation_date}, РџР°РїРєР°: ${folderDate}`);

    const columns = [
        { name: 'important_events', text: important_events },
        { name: 'unnoticed_news', text: unnoticed_news },
        { name: 'independent_analysis', text: independent_analysis }
    ];

    // Р”РёРєС‚РѕСЂ РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ
    const speaker = 'kseniya';

    // Р›РѕРєР°Р»СЊРЅР°СЏ РїР°РїРєР° РґР»СЏ Windows: РёСЃРїРѕР»СЊР·СѓРµРј РґР°С‚Сѓ РёР· Р±Р°Р·С‹
    const localDir = path.join(__dirname, 'audio', 'politica', folderDate);

    console.log(`   [DATE] РСЃРїРѕР»СЊР·СѓРµРј РґР°С‚Сѓ РґР»СЏ РїСѓС‚Рё: ${folderDate}`);

    if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
    }

    let successCount = 0;
    // РЎС‡РёС‚Р°РµРј РѕР±С‰РµРµ РєРѕР»РёС‡РµСЃС‚РІРѕ РєРѕР»РѕРЅРѕРє, РєРѕС‚РѕСЂС‹Рµ РЅСѓР¶РЅРѕ РѕР±СЂР°Р±РѕС‚Р°С‚СЊ (РЅРµ РїСѓСЃС‚С‹С…)
    let targetCount = 0;

    for (const col of columns) {
        if (!col.text || col.text.trim().length === 0) {
            console.log(`   [SKIP] РџСѓСЃС‚РѕР№ С‚РµРєСЃС‚ РІ РєРѕР»РѕРЅРєРµ ${col.name}`);
            continue;
        }
        targetCount++;

        const filename = `${col.name}.wav`;
        const localPath = path.join(localDir, filename);

        console.log(`   [GEN] Р“РµРЅРµСЂР°С†РёСЏ: ${col.name} -> ${localPath}`);

        try {
            // 1. Р“РµРЅРµСЂР°С†РёСЏ
            await generateAudioPython(col.text, speaker, localPath);

            // 2. Р—Р°РіСЂСѓР·РєР° РІ Supabase Storage
            // РџСѓС‚СЊ: politica/{folderDate}/{filename}
            const storagePath = `politica/${folderDate}/${filename}`;

            console.log(`   [UPLOAD] Р—Р°РіСЂСѓР·РєР° РІ Storage: ${storagePath}`);
            const fileBuffer = fs.readFileSync(localPath);

            const { error: uploadError } = await supabase.storage
                .from('audio')
                .upload(storagePath, fileBuffer, {
                    contentType: 'audio/wav',
                    upsert: true
                });

            if (uploadError) throw uploadError;

            console.log(`   [OK] РЈСЃРїРµС€РЅРѕ: ${col.name}`);
            successCount++;

        } catch (e) {
            console.error(`   [FAIL] РћС€РёР±РєР° РѕР±СЂР°Р±РѕС‚РєРё ${col.name}:`, e.message);
        }
    }

    // Р•СЃР»Рё РІСЃРµ РќР• РџРЈРЎРўР«Р• РєРѕР»РѕРЅРєРё РѕР±СЂР°Р±РѕС‚Р°РЅС‹ СѓСЃРїРµС€РЅРѕ
    if (targetCount > 0 && successCount === targetCount) {
        const currentFullDate = new Date().toISOString().split('.')[0] + 'Z';
        console.log(`[DB] РћР±РЅРѕРІР»РµРЅРёРµ Р·Р°РїРёСЃРё ID ${id} (audio = TRUE, date = ${currentFullDate})...`);
        const { error: dbErr } = await supabase
            .from('political_news')
            .update({
                audio: 'TRUE',
                analysis_date: currentFullDate // РћР±РЅРѕРІР»СЏРµРј РґР°С‚Сѓ Р°РЅР°Р»РёР·Р° С‚РµРєСѓС‰РёРј РІСЂРµРјРµРЅРµРј
            })
            .eq('id', id);

        if (dbErr) console.error(`[DB ERROR] РќРµ СѓРґР°Р»РѕСЃСЊ РѕР±РЅРѕРІРёС‚СЊ Р·Р°РїРёСЃСЊ:`, dbErr);
        else console.log(`[DONE] Р—Р°РїРёСЃСЊ ${id} Р·Р°РІРµСЂС€РµРЅР°.`);
    } else if (targetCount === 0) {
        const currentFullDate = new Date().toISOString().split('.')[0] + 'Z';
        console.log(`[DB] Р’ Р·Р°РїРёСЃРё ID ${id} РЅРµС‚ РґР°РЅРЅС‹С… РґР»СЏ РѕР·РІСѓС‡РєРё. РџРѕРјРµС‡Р°РµРј РєР°Рє РІС‹РїРѕР»РЅРµРЅРѕ.`);
        const { error: dbErr } = await supabase
            .from('political_news')
            .update({
                audio: 'TRUE',
                analysis_date: currentFullDate
            })
            .eq('id', id);
        if (dbErr) console.error(`[DB ERROR]`, dbErr);
    } else {
        console.log(`[WARN] Р—Р°РїРёСЃСЊ ${id} Р·Р°РІРµСЂС€РµРЅР° РЅРµ РїРѕР»РЅРѕСЃС‚СЊСЋ (${successCount}/${targetCount}). РЎС‚Р°С‚СѓСЃ РЅРµ РѕР±РЅРѕРІР»РµРЅ.`);
    }
}

function generateAudioPython(text, speaker, outputPath) {
    return new Promise((resolve, reject) => {
        const pythonScriptPath = path.join(__dirname, 'src', 'worker.py');
        const pythonProcess = spawn('python', [pythonScriptPath]);

        const inputPayload = JSON.stringify({
            text: text,
            speaker: speaker,
            output_path: outputPath
        });

        let stdoutData = '';
        let stderrData = '';

        pythonProcess.stdout.on('data', (data) => {
            const str = data.toString();
            stdoutData += str;
            if (str.includes('[MODEL]')) {
                process.stdout.write(str);
            }
        });

        pythonProcess.stderr.on('data', (data) => {
            stderrData += data.toString();
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                return reject(new Error(`Python Exit Code ${code}.\nSTDERR: ${stderrData}\nSTDOUT: ${stdoutData}`));
            }
            try {
                const lines = stdoutData.trim().split('\n');
                const lastLine = lines[lines.length - 1];
                let result;
                try {
                    result = JSON.parse(lastLine);
                } catch (e) {
                    return reject(new Error(`РќРµРєРѕСЂСЂРµРєС‚РЅС‹Р№ JSON РѕС‚ Python: ${lastLine}`));
                }

                if (result.status === 'success') {
                    resolve(result);
                } else {
                    reject(new Error(result.message || 'РћС€РёР±РєР° РІРЅСѓС‚СЂРё Python'));
                }
            } catch (err) {
                reject(err);
            }
        });

        pythonProcess.stdin.write(inputPayload, 'utf-8');
        pythonProcess.stdin.end();
    });
}

// Р—Р°РїСѓСЃРє
(async () => {
    const isPy = fs.existsSync(path.join(__dirname, 'src', 'worker.py'));
    if (!isPy) console.error('[WARN] worker.py РЅРµ РЅР°Р№РґРµРЅ!');

    processPoliticalNews();
})();

