import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { execa } from 'execa';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';
import { generateSubtitles, checkWhisperAvailability } from './whisper-helper.js';
import { addSubtitlesToVideo, checkSubtitleSupport } from './subtitle-helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Р—Р°РіСЂСѓР·РєР° РїРµСЂРµРјРµРЅРЅС‹С… РѕРєСЂСѓР¶РµРЅРёСЏ
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const VIDEO_SERVER_IP = process.env.VIDEO_SERVER_IP;
const VIDEO_SERVER_PORT = process.env.VIDEO_SERVER_PORT;
const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg';
const FFMPEG_OUTPUT_DIR = process.env.FFMPEG_OUTPUT_DIR || path.join(__dirname, 'output-videos');
const MEDIA_DIR = process.env.MEDIA_DIR || path.join(__dirname, 'media');
const POLLING_INTERVAL = 10000; // 10 СЃРµРєСѓРЅРґ
const MAX_CONCURRENT_TASKS = parseInt(process.env.MAX_CONCURRENT_TASKS || '5');

const WHISPER_MODEL = process.env.WHISPER_MODEL || 'turbo';

// РћС‚СЃР»РµР¶РёРІР°РЅРёРµ Р°РєС‚РёРІРЅС‹С… Р·Р°РґР°С‡
const activeTasks = new Set();

// РџСЂРѕРІРµСЂРєР° РѕР±СЏР·Р°С‚РµР»СЊРЅС‹С… РїРµСЂРµРјРµРЅРЅС‹С… РѕРєСЂСѓР¶РµРЅРёСЏ
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) { console.warn('⚠️ Supabase ключи не найдены. Воркер будет работать только локально.'); }

// РЎРѕР·РґР°РЅРёРµ РєР»РёРµРЅС‚Р° Supabase
const supabase = (SUPABASE_URL && SUPABASE_SERVICE_KEY) ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY) : null;

// РРЅРёС†РёР°Р»РёР·Р°С†РёСЏ РґРёСЂРµРєС‚РѕСЂРёР№ Рё РїСЂРѕРІРµСЂРєР° Р·Р°РІРёСЃРёРјРѕСЃС‚РµР№
async function initializeDirectories() {
  try {
    await fs.ensureDir(MEDIA_DIR);
    await fs.ensureDir(FFMPEG_OUTPUT_DIR);
    console.log('вњ… Р”РёСЂРµРєС‚РѕСЂРёРё РёРЅРёС†РёР°Р»РёР·РёСЂРѕРІР°РЅС‹:');
    console.log(`   - Media: ${path.resolve(MEDIA_DIR)}`);
    console.log(`   - Output: ${path.resolve(FFMPEG_OUTPUT_DIR)}`);

    // РџСЂРѕРІРµСЂСЏРµРј РґРѕСЃС‚СѓРїРЅРѕСЃС‚СЊ Whisper РґР»СЏ СЃСѓР±С‚РёС‚СЂРѕРІ
    console.log('\nрџЋ¤ РџСЂРѕРІРµСЂРєР° Whisper...');
    const whisperAvailable = await checkWhisperAvailability();
    if (whisperAvailable) {
      console.log(`вњ… Whisper РґРѕСЃС‚СѓРїРµРЅ (РјРѕРґРµР»СЊ: ${WHISPER_MODEL})`);
      
      // РџСЂРѕРІРµСЂСЏРµРј РїРѕРґРґРµСЂР¶РєСѓ СЃСѓР±С‚РёС‚СЂРѕРІ РІ FFmpeg
      const subtitleSupport = await checkSubtitleSupport(FFMPEG_PATH);
      if (subtitleSupport) {
        console.log('вњ… FFmpeg РїРѕРґРґРµСЂР¶РёРІР°РµС‚ СЃСѓР±С‚РёС‚СЂС‹');
      } else {
        console.warn('вљ пёЏ FFmpeg РјРѕР¶РµС‚ РЅРµ РїРѕРґРґРµСЂР¶РёРІР°С‚СЊ С„РёР»СЊС‚СЂ СЃСѓР±С‚РёС‚СЂРѕРІ');
      }
    } else {
      console.warn('вљ пёЏ Whisper РЅРµРґРѕСЃС‚СѓРїРµРЅ - СЃРѕР·РґР°РЅРёРµ СЃСѓР±С‚РёС‚СЂРѕРІ Р±СѓРґРµС‚ РЅРµРІРѕР·РјРѕР¶РЅРѕ');
    }
  } catch (error) {
    console.error('вќЊ РћС€РёР±РєР° РїСЂРё СЃРѕР·РґР°РЅРёРё РґРёСЂРµРєС‚РѕСЂРёР№:', error);
    process.exit(1);
  }
}

// Р¤СѓРЅРєС†РёСЏ РґР»СЏ СЃРєР°С‡РёРІР°РЅРёСЏ С„Р°Р№Р»Р°
async function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(outputPath);
    
    protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(outputPath, () => {});
      reject(err);
    });
  });
}

// Р¤СѓРЅРєС†РёСЏ Р·Р°РіСЂСѓР·РєРё РІРёРґРµРѕ РІ Supabase Storage
async function uploadVideoToSupabase(videoPath, videoId) {
  try {
    console.log(`вЃпёЏ Р—Р°РіСЂСѓР·РєР° РІРёРґРµРѕ РІ Supabase Storage: ${videoId}`);
    
    const videoBuffer = await fs.readFile(videoPath);
    
    const { data, error } = await supabase.storage
      .from('videos')
      .upload(`${videoId}.mp4`, videoBuffer, {
        contentType: 'video/mp4',
        upsert: true
      });
    
    if (error) throw error;
    
    const { data: publicUrlData } = supabase.storage
      .from('videos')
      .getPublicUrl(`${videoId}.mp4`);
    
    console.log(`вњ… Р’РёРґРµРѕ Р·Р°РіСЂСѓР¶РµРЅРѕ РІ РѕР±Р»Р°РєРѕ: ${publicUrlData.publicUrl}`);
    return publicUrlData.publicUrl;
    
  } catch (error) {
    console.error(`вќЊ РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё РІ Supabase Storage:`, error);
    throw error;
  }
}

// Р¤СѓРЅРєС†РёСЏ РѕР±РЅРѕРІР»РµРЅРёСЏ СЃС‚Р°С‚СѓСЃР° РІРёРґРµРѕ
async function updateVideoStatus(videoId, status, errorMessage = null) {
  try {
    const updateData = { 
      status,
      updated_at: new Date().toISOString()
    };
    if (errorMessage) updateData.error_message = errorMessage;
    
    const { error } = await supabase
      .from('videos')
      .update(updateData)
      .eq('id', videoId);
    
    if (error) {
      console.error(`вќЊ РћС€РёР±РєР° РѕР±РЅРѕРІР»РµРЅРёСЏ СЃС‚Р°С‚СѓСЃР° РґР»СЏ ${videoId}:`, error);
      // РќРµ Р±СЂРѕСЃР°РµРј РѕС€РёР±РєСѓ РґР°Р»СЊС€Рµ, С‡С‚РѕР±С‹ РЅРµ РїСЂРµСЂС‹РІР°С‚СЊ finally, РЅРѕ Р»РѕРіРёСЂСѓРµРј
    } else {
      console.log(`вњ… РЎС‚Р°С‚СѓСЃ РѕР±РЅРѕРІР»РµРЅ: ${videoId} -> ${status}`);
    }
  } catch (error) {
    // Р­С‚Р° РѕС€РёР±РєР° РјРѕР¶РµС‚ РІРѕР·РЅРёРєРЅСѓС‚СЊ, РµСЃР»Рё СЃР°Рј supabase РєР»РёРµРЅС‚ РїР°РґР°РµС‚
    console.error(`вќЊ РљСЂРёС‚РёС‡РµСЃРєР°СЏ РѕС€РёР±РєР° РІ updateVideoStatus РґР»СЏ ${videoId}:`, error);
  }
}

// Р¤СѓРЅРєС†РёСЏ РѕР±РЅРѕРІР»РµРЅРёСЏ С„РёРЅР°Р»СЊРЅРѕРіРѕ РІРёРґРµРѕ РІ workflow
async function updateWorkflowVideo(workflowId, videoUrl) {
  try {
    const updateData = {
      final_video_url: videoUrl,
      updated_at: new Date().toISOString()
    };
    
    const { error } = await supabase
      .from('workflows')
      .update(updateData)
      .eq('id', workflowId);
    
    if (error) throw error;
    console.log(`вњ… Workflow РѕР±РЅРѕРІР»РµРЅ: ${workflowId} -> РІРёРґРµРѕ URL РґРѕР±Р°РІР»РµРЅ`);
  } catch (error) {
    console.error(`вќЊ РћС€РёР±РєР° РѕР±РЅРѕРІР»РµРЅРёСЏ workflow ${workflowId}:`, error);
  }
}

// РџРѕР»СѓС‡РµРЅРёРµ СЂР°СЃС€РёСЂРµРЅРёСЏ С„Р°Р№Р»Р° РёР· URL
function getFileExtension(url) {
  const urlPath = new URL(url).pathname;
  const ext = path.extname(urlPath);
  return ext || '.mp4';
}

// РћСЃРЅРѕРІРЅР°СЏ С„СѓРЅРєС†РёСЏ РѕР±СЂР°Р±РѕС‚РєРё Р·Р°РґР°С‡Рё
async function processVideoTask(task) {
  const taskDir = path.join(MEDIA_DIR, task.id);
  const { id: videoId, workflow_id } = task;

  try {
    console.log(`\nрџЋ¬ РќР°С‡Р°Р»Рѕ РѕР±СЂР°Р±РѕС‚РєРё Р·Р°РґР°С‡Рё: ${videoId}`);

    // РЁР°Рі 1: РЈСЃС‚Р°РЅРѕРІРёС‚СЊ СЃС‚Р°С‚СѓСЃ processing
    await updateVideoStatus(videoId, 'processing');
    await fs.ensureDir(taskDir);

    // РЁР°Рі 2: РџРѕР»СѓС‡РёС‚СЊ РєРѕРЅС„РёРі РіРµРЅРµСЂР°С†РёРё
    console.log(`вљ™пёЏ РџРѕР»СѓС‡РµРЅРёРµ РєРѕРЅС„РёРіСѓСЂР°С†РёРё РґР»СЏ workflow: ${workflow_id}`);
    const { data: genConfig, error: configError } = await supabase
      .from('generation_configs')
      .select('*')
      .eq('workflow_id', workflow_id)
      .single();

    if (configError || !genConfig) {
      throw new Error(`РљРѕРЅС„РёРіСѓСЂР°С†РёСЏ РіРµРЅРµСЂР°С†РёРё РґР»СЏ workflow ${workflow_id} РЅРµ РЅР°Р№РґРµРЅР°: ${configError?.message}`);
    }

    const {
      is_voiceover_enabled,
      is_subtitles_enabled,
      subtitle_language,
      subtitle_style, // РџСЂРµРґРїРѕР»Р°РіР°РµС‚СЃСЏ, С‡С‚Рѕ СЌС‚Рѕ РѕР±СЉРµРєС‚ СЃРѕ СЃС‚РёР»СЏРјРё
      watermark_type
    } = genConfig;

    console.log('  - РљРѕРЅС„РёРіСѓСЂР°С†РёСЏ РїРѕР»СѓС‡РµРЅР°:', { is_voiceover_enabled, is_subtitles_enabled, subtitle_language });

    // РЁР°Рі 3: Р—Р°РіСЂСѓР·РєР° РјРµРґРёР°
    console.log('рџ“Ґ Р—Р°РіСЂСѓР·РєР° РјРµРґРёР°С„Р°Р№Р»РѕРІ...');

    let voiceover_audio_url = null;
    const audioPath = path.join(taskDir, `${workflow_id}_audio.mp3`);

    if (is_voiceover_enabled) {
      const { data: workflowData, error: workflowError } = await supabase
        .from('workflows')
        .select('voiceover_audio_url')
        .eq('id', workflow_id)
        .single();

      if (workflowError || !workflowData || !workflowData.voiceover_audio_url) {
        throw new Error(`РђСѓРґРёРѕС„Р°Р№Р» РґР»СЏ workflow ${workflow_id} РЅРµ РЅР°Р№РґРµРЅ: ${workflowError?.message}`);
      }
      voiceover_audio_url = workflowData.voiceover_audio_url;
      console.log(`  - Р—Р°РіСЂСѓР·РєР° Р°СѓРґРёРѕ: ${voiceover_audio_url}`);
      await downloadFile(voiceover_audio_url, audioPath);
    } else {
      console.log('  - РћР·РІСѓС‡РєР° РѕС‚РєР»СЋС‡РµРЅР° РІ РєРѕРЅС„РёРіСѓСЂР°С†РёРё.');
    }

    // Р—Р°РіСЂСѓР·РєР° РєР°РґСЂРѕРІ РёР· С‚Р°Р±Р»РёС†С‹ frames
    const { data: framesData, error: framesError } = await supabase
      .from('frames')
      .select('*')
      .eq('workflow_id', workflow_id)
      .order('frame_number', { ascending: true });

    if (framesError || !framesData || framesData.length === 0) {
      throw new Error(`РљР°РґСЂС‹ РґР»СЏ workflow ${workflow_id} РЅРµ РЅР°Р№РґРµРЅС‹: ${framesError?.message}`);
    }

    console.log(`  - РќР°Р№РґРµРЅРѕ РєР°РґСЂРѕРІ: ${framesData.length}`);

    const frames = [];
    for (const frame of framesData) {
      const frameUrl = frame.url;

      if (!frameUrl) {
        console.warn(`вљ пёЏ РџСЂРѕРїСѓСЃРє РєР°РґСЂР° ${frame.frame_number}: РЅРµС‚ URL`);
        continue;
      }

      const ext = getFileExtension(frameUrl);
      const framePath = path.join(taskDir, `${workflow_id}_frame_${frame.frame_number}${ext}`);

      console.log(`  - Р—Р°РіСЂСѓР·РєР° РєР°РґСЂР° ${frame.frame_number}: ${frameUrl}`);
      await downloadFile(frameUrl, framePath);

      frames.push({
        ...frame,
        localPath: framePath,
        frame_type: frame.frame_type || 'static',
        duration_seconds: frame.duration_seconds || 5
      });
    }

    // РЁР°Рі 4: РћР±СЂР°Р±РѕС‚РєР° СЃ FFmpeg
    console.log('рџЋћпёЏ РћР±СЂР°Р±РѕС‚РєР° РІРёРґРµРѕ СЃ FFmpeg...');
    const processedClips = [];

    for (const frame of frames) {
      const outputClip = path.join(taskDir, `clip_${frame.frame_number}.ts`);
      if (frame.frame_type === 'static') {
        console.log(`  - РљРѕРЅРІРµСЂС‚Р°С†РёСЏ РёР·РѕР±СЂР°Р¶РµРЅРёСЏ ${frame.frame_number} (${frame.duration_seconds}s)`);
        await execa(FFMPEG_PATH, [
          '-loop', '1', '-i', frame.localPath, '-c:v', 'libx264', '-t', String(frame.duration_seconds),
          '-pix_fmt', 'yuv420p', '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1',
          '-r', '30', '-f', 'mpegts', '-y', outputClip
        ]);
      } else {
        console.log(`  - РќРѕСЂРјР°Р»РёР·Р°С†РёСЏ РІРёРґРµРѕ ${frame.frame_number}`);
        await execa(FFMPEG_PATH, [
          '-i', frame.localPath, '-c:v', 'libx264', '-an', '-pix_fmt', 'yuv420p',
          '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1',
          '-r', '30', '-f', 'mpegts', '-y', outputClip
        ]);
      }
      processedClips.push(outputClip);
    }

    const concatListPath = path.join(taskDir, 'concat_list.txt');
    const concatContent = processedClips.map(clip => `file '${path.basename(clip)}'`).join('\n');
    await fs.writeFile(concatListPath, concatContent);

    const mergedVideoPath = path.join(taskDir, 'merged_no_audio.mp4');
    console.log('  - РЎРєР»РµР№РєР° РєР»РёРїРѕРІ...');
    await execa(FFMPEG_PATH, ['-f', 'concat', '-safe', '0', '-i', 'concat_list.txt', '-c', 'copy', '-y', 'merged_no_audio.mp4'], { cwd: taskDir });

    const finalVideoPath = path.join(taskDir, 'final.mp4');
    if (is_voiceover_enabled && (await fs.pathExists(audioPath))) {
      console.log('  - Р”РѕР±Р°РІР»РµРЅРёРµ Р°СѓРґРёРѕ...');
      const getDuration = async (filePath) => {
        try {
          const { stderr } = await execa(FFMPEG_PATH, ['-i', filePath, '-f', 'null', '-'], { cwd: taskDir, reject: false });
          const durationMatch = stderr.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/);
          if (durationMatch) {
            const hours = parseInt(durationMatch[1]);
            const minutes = parseInt(durationMatch[2]);
            const seconds = parseFloat(durationMatch[3]);
            return hours * 3600 + minutes * 60 + seconds;
          }
          return 0;
        } catch (error) {
          console.error(`РћС€РёР±РєР° РїРѕР»СѓС‡РµРЅРёСЏ РґР»РёС‚РµР»СЊРЅРѕСЃС‚Рё РґР»СЏ ${filePath}:`, error);
          return 0;
        }
      };

      const videoDuration = await getDuration('merged_no_audio.mp4');
      const audioDuration = await getDuration(path.basename(audioPath));

      console.log(`  - Р”Р»РёС‚РµР»СЊРЅРѕСЃС‚СЊ РІРёРґРµРѕ: ${videoDuration.toFixed(2)}s`);
      console.log(`  - Р”Р»РёС‚РµР»СЊРЅРѕСЃС‚СЊ Р°СѓРґРёРѕ: ${audioDuration.toFixed(2)}s`);

      if (videoDuration >= audioDuration) {
        console.log('  - Р’РёРґРµРѕ РґР»РёРЅРЅРµРµ Р°СѓРґРёРѕ, РЅР°РєР»Р°РґС‹РІР°РµРј Р±РµР· РѕР±СЂРµР·РєРё');
        await execa(FFMPEG_PATH, [
          '-i', 'merged_no_audio.mp4', '-i', path.basename(audioPath), '-c:v', 'copy', '-c:a', 'aac',
          '-map', '0:v:0', '-map', '1:a:0', '-y', 'final.mp4'
        ], { cwd: taskDir });
      } else {
        console.log('  - РђСѓРґРёРѕ РґР»РёРЅРЅРµРµ РІРёРґРµРѕ, Р·Р°РјРѕСЂР°Р¶РёРІР°РµРј РїРѕСЃР»РµРґРЅРёР№ РєР°РґСЂ');
        const extensionTime = audioDuration - videoDuration;
        console.log(`  - РџСЂРѕРґР»РµРІР°РµРј РІРёРґРµРѕ РЅР° ${extensionTime.toFixed(2)}s`);

        const lastFramePath = path.join(taskDir, 'last_frame.png');
        await execa(FFMPEG_PATH, ['-sseof', '-0.1', '-i', 'merged_no_audio.mp4', '-update', '1', '-q:v', '1', '-y', 'last_frame.png'], { cwd: taskDir });

        const frozenVideoPath = path.join(taskDir, 'frozen_frame.mp4');
        await execa(FFMPEG_PATH, [
          '-loop', '1', '-i', 'last_frame.png', '-c:v', 'libx264', '-t', String(extensionTime),
          '-pix_fmt', 'yuv420p', '-vf', 'scale=iw*1.05:ih*1.05,scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1',
          '-r', '30', '-y', 'frozen_frame.mp4'
        ], { cwd: taskDir });

        const extendedConcatPath = path.join(taskDir, 'extended_concat.txt');
        const extendedConcatContent = "file 'merged_no_audio.mp4'\nfile 'frozen_frame.mp4'";
        await fs.writeFile(extendedConcatPath, extendedConcatContent);

        const extendedVideoPath = path.join(taskDir, 'extended_video.mp4');
        await execa(FFMPEG_PATH, ['-f', 'concat', '-safe', '0', '-i', 'extended_concat.txt', '-c', 'copy', '-y', 'extended_video.mp4'], { cwd: taskDir });

        await execa(FFMPEG_PATH, [
          '-i', 'extended_video.mp4', '-i', path.basename(audioPath), '-c:v', 'copy', '-c:a', 'aac',
          '-map', '0:v:0', '-map', '1:a:0', '-y', 'final.mp4'
        ], { cwd: taskDir });
      }
    } else {
      await fs.copy(mergedVideoPath, finalVideoPath);
    }

    // РЁР°Рі 5: РЎРѕР·РґР°РЅРёРµ Рё РЅР°Р»РѕР¶РµРЅРёРµ СЃСѓР±С‚РёС‚СЂРѕРІ
    let videoToUpload = finalVideoPath;
    if (is_subtitles_enabled && is_voiceover_enabled && (await fs.pathExists(audioPath))) {
      try {
        console.log('рџ“ќ РЎРѕР·РґР°РЅРёРµ СЃСѓР±С‚РёС‚СЂРѕРІ СЃ РїРѕРјРѕС‰СЊСЋ Whisper...');
        const subtitlesPath = await generateSubtitles(audioPath, taskDir, subtitle_language);

        if (await fs.pathExists(subtitlesPath)) {
          console.log('рџЋ¬ РќР°Р»РѕР¶РµРЅРёРµ СЃСѓР±С‚РёС‚СЂРѕРІ РЅР° РІРёРґРµРѕ...');
          const videoWithSubtitlesPath = path.join(taskDir, 'final_with_subtitles.mp4');
          
          // TODO: РСЃРїРѕР»СЊР·РѕРІР°С‚СЊ subtitle_style РёР· genConfig
          const subtitleOptions = {
            fontName: 'Montserrat',
            fontSize: 8,
            fontColor: 'white',
            backgroundColor: 'black@0.7',
            position: 'bottom',
            alignment: 2,
            marginV: 220,
            borderWidth: 1,
            borderColor: 'black',
            ...(typeof subtitle_style === 'object' ? subtitle_style : {})
          };

          await addSubtitlesToVideo(finalVideoPath, subtitlesPath, videoWithSubtitlesPath, FFMPEG_PATH, subtitleOptions);

          if (await fs.pathExists(videoWithSubtitlesPath)) {
            videoToUpload = videoWithSubtitlesPath;
            console.log('вњ… РЎСѓР±С‚РёС‚СЂС‹ СѓСЃРїРµС€РЅРѕ РЅР°Р»РѕР¶РµРЅС‹');
          } else {
            console.warn('вљ пёЏ РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕР·РґР°С‚СЊ РІРёРґРµРѕ СЃ СЃСѓР±С‚РёС‚СЂР°РјРё, РёСЃРїРѕР»СЊР·СѓРµРј РѕСЂРёРіРёРЅР°Р»');
          }
        }
      } catch (subtitleError) {
        console.error('вќЊ РћС€РёР±РєР° РїСЂРё СЃРѕР·РґР°РЅРёРё СЃСѓР±С‚РёС‚СЂРѕРІ:', subtitleError);
        console.log('в„№пёЏ РџСЂРѕРґРѕР»Р¶Р°РµРј Р±РµР· СЃСѓР±С‚РёС‚СЂРѕРІ...');
      }
    } else if (is_subtitles_enabled) {
      console.log('в„№пёЏ РЎСѓР±С‚РёС‚СЂС‹ РІРєР»СЋС‡РµРЅС‹, РЅРѕ РѕР·РІСѓС‡РєР° РѕС‚РєР»СЋС‡РµРЅР°. РџСЂРѕРїСѓСЃРє СЃРѕР·РґР°РЅРёСЏ СЃСѓР±С‚РёС‚СЂРѕРІ.');
    }

    // РЁР°Рі 6: Р—Р°РіСЂСѓР·РєР° РІ Supabase Storage
    console.log(`вЃпёЏ Р—Р°РіСЂСѓР·РєР° РІРёРґРµРѕ РІ Supabase Storage...`);
    const publicUrl = await uploadVideoToSupabase(videoToUpload, videoId);

    // РЁР°Рі 7: РћР±РЅРѕРІР»РµРЅРёРµ С‚Р°Р±Р»РёС†
    await updateWorkflowVideo(workflow_id, publicUrl);
    await updateVideoStatus(videoId, 'succeed');

    console.log(`вњ… Р—Р°РґР°С‡Р° Р·Р°РІРµСЂС€РµРЅР°: ${videoId}`);
    console.log(`рџЊЌ URL РІРёРґРµРѕ (РіР»РѕР±Р°Р»СЊРЅС‹Р№ РґРѕСЃС‚СѓРї): ${publicUrl}`);
    
  } catch (error) {
    console.error(`вќЊ РћС€РёР±РєР° РѕР±СЂР°Р±РѕС‚РєРё Р·Р°РґР°С‡Рё ${videoId}:`, error);
    await updateVideoStatus(videoId, 'failed', error.message);
  } finally {
    // РћС‡РёСЃС‚РєР° РІСЂРµРјРµРЅРЅРѕР№ РїР°РїРєРё
    try {
      await fs.remove(taskDir);
      console.log(`рџ§№ Р’СЂРµРјРµРЅРЅР°СЏ РїР°РїРєР° СѓРґР°Р»РµРЅР°: ${taskDir}`);
    } catch (cleanupError) {
      console.error(`вљ пёЏ РћС€РёР±РєР° РїСЂРё СѓРґР°Р»РµРЅРёРё РІСЂРµРјРµРЅРЅРѕР№ РїР°РїРєРё ${taskDir}:`, cleanupError);
    }
  }
}

// Polling: РѕРїСЂРѕСЃ Р±Р°Р·С‹ РґР°РЅРЅС‹С… РєР°Р¶РґС‹Рµ 10 СЃРµРєСѓРЅРґ
async function pollForNewTasks() {
  try {
    // РџСЂРѕРІРµСЂСЏРµРј, РЅРµ РїСЂРµРІС‹С€РµРЅ Р»Рё Р»РёРјРёС‚ РѕРґРЅРѕРІСЂРµРјРµРЅРЅС‹С… Р·Р°РґР°С‡
    if (activeTasks.size >= MAX_CONCURRENT_TASKS) {
      console.log(`вЏі Р”РѕСЃС‚РёРіРЅСѓС‚ Р»РёРјРёС‚ Р·Р°РґР°С‡ (${activeTasks.size}/${MAX_CONCURRENT_TASKS}), РѕР¶РёРґР°РЅРёРµ...`);
      return;
    }

    // РџРѕР»СѓС‡Р°РµРј РЅРѕРІС‹Рµ Р·Р°РґР°С‡Рё РёР· Р±Р°Р·С‹ РґР°РЅРЅС‹С…
    const { data: tasks, error } = await supabase
      .from('videos')
      .select('*')
      .eq('status', 'new')
      .order('created_at', { ascending: true })
      .limit(MAX_CONCURRENT_TASKS - activeTasks.size);

    if (error) {
      console.error('вќЊ РћС€РёР±РєР° РїСЂРё РїРѕР»СѓС‡РµРЅРёРё Р·Р°РґР°С‡:', error);
      return;
    }

    if (tasks && tasks.length > 0) {
      console.log(`рџ“Ё РќР°Р№РґРµРЅРѕ РЅРѕРІС‹С… Р·Р°РґР°С‡: ${tasks.length}`);
      
      for (const task of tasks) {
        // Р”РѕР±Р°РІР»СЏРµРј Р·Р°РґР°С‡Сѓ РІ Р°РєС‚РёРІРЅС‹Рµ
        activeTasks.add(task.id);
        
        // Р—Р°РїСѓСЃРєР°РµРј РѕР±СЂР°Р±РѕС‚РєСѓ Р°СЃРёРЅС…СЂРѕРЅРЅРѕ
        processVideoTask(task)
          .finally(() => {
            // РЈРґР°Р»СЏРµРј РёР· Р°РєС‚РёРІРЅС‹С… РїРѕСЃР»Рµ Р·Р°РІРµСЂС€РµРЅРёСЏ
            activeTasks.delete(task.id);
          });
      }
    }
  } catch (error) {
    console.error('вќЊ РћС€РёР±РєР° РїСЂРё РѕРїСЂРѕСЃРµ Р±Р°Р·С‹ РґР°РЅРЅС‹С…:', error);
  }
}

// Р—Р°РїСѓСЃРє polling
function startPolling() {
  console.log(`рџ‘‚ Р—Р°РїСѓСЃРє polling (РёРЅС‚РµСЂРІР°Р»: ${POLLING_INTERVAL / 1000}s, РјР°РєСЃ. Р·Р°РґР°С‡: ${MAX_CONCURRENT_TASKS})`);
  console.log('вњ… Polling Р°РєС‚РёРІРµРЅ. РћР¶РёРґР°РЅРёРµ Р·Р°РґР°С‡...');
  
  // РџРµСЂРІС‹Р№ РѕРїСЂРѕСЃ СЃСЂР°Р·Сѓ
  pollForNewTasks();
  
  // Р—Р°С‚РµРј РѕРїСЂРѕСЃ РєР°Р¶РґС‹Рµ 10 СЃРµРєСѓРЅРґ
  setInterval(pollForNewTasks, POLLING_INTERVAL);
}

// Р—Р°РїСѓСЃРє РІРѕСЂРєРµСЂР°
async function startWorker() {
  console.log('рџљЂ Р—Р°РїСѓСЃРє РІРѕСЂРєРµСЂР° РѕР±СЂР°Р±РѕС‚РєРё РІРёРґРµРѕ...');
  console.log('================================');
  
  await initializeDirectories();
  startPolling();
  
  console.log('================================');
  console.log('вњ… Р’РѕСЂРєРµСЂ Р·Р°РїСѓС‰РµРЅ Рё РіРѕС‚РѕРІ Рє СЂР°Р±РѕС‚Рµ');
}

// РћР±СЂР°Р±РѕС‚РєР° СЃРёРіРЅР°Р»РѕРІ Р·Р°РІРµСЂС€РµРЅРёСЏ
process.on('SIGINT', () => {
  console.log('\nрџ‘‹ РџРѕР»СѓС‡РµРЅ СЃРёРіРЅР°Р» РѕСЃС‚Р°РЅРѕРІРєРё. Р—Р°РІРµСЂС€РµРЅРёРµ СЂР°Р±РѕС‚С‹...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nрџ‘‹ РџРѕР»СѓС‡РµРЅ СЃРёРіРЅР°Р» Р·Р°РІРµСЂС€РµРЅРёСЏ. Р—Р°РІРµСЂС€РµРЅРёРµ СЂР°Р±РѕС‚С‹...');
  process.exit(0);
});

// Р—Р°РїСѓСЃРє
startWorker().catch((error) => {
  console.error('вќЊ РљСЂРёС‚РёС‡РµСЃРєР°СЏ РѕС€РёР±РєР° РїСЂРё Р·Р°РїСѓСЃРєРµ РІРѕСЂРєРµСЂР°:', error);
  process.exit(1);
});



