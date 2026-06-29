import { execa } from 'execa';
import fs from 'fs-extra';
import path from 'path';

/**
 * Модуль для работы с Whisper - создание субтитров из аудио
 */

const WHISPER_PATH = process.env.WHISPER_PATH || 'whisper';
const WHISPER_MODEL = process.env.WHISPER_MODEL || 'turbo';

/**
 * Создает субтитры из аудиофайла с помощью Whisper
 * @param {string} audioPath - путь к аудиофайлу
 * @param {string} outputDir - директория для сохранения субтитров
 * @param {string} language - язык аудио (опционально, auto-detect если не указан)
 * @returns {Promise<string>} - путь к созданному SRT файлу
 */
export async function generateSubtitles(audioPath, outputDir, language = null) {
  try {
    // Преобразуем все пути в абсолютные для надежности
    const absoluteAudioPath = path.resolve(audioPath);
    const absoluteOutputDir = path.resolve(outputDir);
    
    console.log(`🎤 Создание субтитров для: ${audioPath}`);
    
    // Проверяем существование аудиофайла
    if (!await fs.pathExists(absoluteAudioPath)) {
      throw new Error(`Аудиофайл не найден: ${absoluteAudioPath}`);
    }

    // Создаем директорию для вывода
    await fs.ensureDir(absoluteOutputDir);

    // Подготавливаем команду WhisperX
    const whisperArgs = [
      absoluteAudioPath,
      '--model', WHISPER_MODEL,
      '--output_format', 'srt',
      '--output_dir', absoluteOutputDir
    ];

    // Добавляем язык если указан
    if (language) {
      whisperArgs.push('--language', language);
    }

    console.log(`  - Модель: ${WHISPER_MODEL}`);
    console.log(`  - Язык: ${language || 'auto-detect'}`);
    console.log(`  - Вывод: ${absoluteOutputDir}`);

    // Запускаем Whisper БЕЗ изменения рабочей директории
    // Whisper внутри вызывает FFmpeg, который должен работать из текущей директории проекта
    const { stdout, stderr } = await execa(WHISPER_PATH, whisperArgs, {
      env: { 
        ...process.env,
        PYTHONIOENCODING: 'utf-8' // Предотвращаем проблемы с кодировкой на Windows
      }
    });

    if (stderr && !stderr.includes('UserWarning')) {
      console.warn(`⚠️ Whisper warnings: ${stderr}`);
    }

    // Определяем путь к созданному SRT файлу
    const audioBasename = path.basename(absoluteAudioPath, path.extname(absoluteAudioPath));
    const srtPath = path.join(absoluteOutputDir, `${audioBasename}.srt`);

    // Проверяем, что файл субтитров создан
    if (!await fs.pathExists(srtPath)) {
      throw new Error(`Файл субтитров не создан: ${srtPath}`);
    }

    console.log(`✅ Субтитры созданы: ${srtPath}`);
    return srtPath;

  } catch (error) {
    console.error(`❌ Ошибка создания субтитров:`, error);
    throw error;
  }
}

/**
 * Проверяет доступность Whisper
 * @returns {Promise<boolean>}
 */
export async function checkWhisperAvailability() {
  try {
    // Проверяем доступность WhisperX
    const { stdout, stderr } = await execa(WHISPER_PATH, [
      '--help'
    ], {
      env: { 
        ...process.env,
        PYTHONIOENCODING: 'utf-8' // Устанавливаем UTF-8 для вывода Python
      }
    });
    return stdout.includes('whisperx');
  } catch (error) {
    console.error('❌ Whisper недоступен:', error.message);
    return false;
  }
}

/**
 * Получает информацию о доступных моделях Whisper
 * @returns {Promise<string[]>}
 */
export async function getAvailableModels() {
  try {
    const models = ['tiny', 'base', 'small', 'medium', 'large', 'turbo'];
    return models;
  } catch (error) {
    console.error('❌ Ошибка получения моделей:', error);
    return ['turbo']; // fallback
  }
}

/**
 * Очищает и форматирует SRT файл для лучшей совместимости с FFmpeg
 * @param {string} srtPath - путь к SRT файлу
 * @returns {Promise<string>} - путь к очищенному файлу
 */
export async function cleanSrtFile(srtPath) {
  try {
    const content = await fs.readFile(srtPath, 'utf8');
    
    // Очищаем содержимое от проблемных символов
    const cleanedContent = content
      .replace(/\r\n/g, '\n')  // Нормализуем переносы строк
      .replace(/\r/g, '\n')    // Убираем старые Mac переносы
      .replace(/[^\x00-\x7F]/g, (char) => {  // Обрабатываем не-ASCII символы
        // Сохраняем основные символы пунктуации
        const allowedChars = 'абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ';
        return allowedChars.includes(char) ? char : '';
      })
      .replace(/\n{3,}/g, '\n\n');  // Убираем лишние переносы

    const cleanedPath = srtPath.replace('.srt', '_cleaned.srt');
    await fs.writeFile(cleanedPath, cleanedContent, 'utf8');
    
    console.log(`✅ SRT файл очищен: ${cleanedPath}`);
    return cleanedPath;
    
  } catch (error) {
    console.error(`❌ Ошибка очистки SRT файла:`, error);
    return srtPath; // Возвращаем оригинальный файл в случае ошибки
  }
}
