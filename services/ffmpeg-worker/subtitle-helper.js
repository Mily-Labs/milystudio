import { execa } from 'execa';
import fs from 'fs-extra';
import path from 'path';

/**
 * Модуль для наложения субтитров на видео с помощью FFmpeg
 */

/**
 * Накладывает субтитры на видео с заданным стилем
 * @param {string} videoPath - путь к видеофайлу
 * @param {string} subtitlePath - путь к файлу субтитров (SRT)
 * @param {string} outputPath - путь для сохранения видео с субтитрами
 * @param {string} ffmpegPath - путь к FFmpeg
 * @param {Object} options - опции стиля субтитров
 * @returns {Promise<string>} - путь к видео с субтитрами
 */
export async function addSubtitlesToVideo(videoPath, subtitlePath, outputPath, ffmpegPath, options = {}) {
  try {
    console.log(`📝 Наложение субтитров на видео: ${path.basename(videoPath)}`);
    
    // Преобразуем пути в абсолютные сразу
    const absoluteVideoPath = path.resolve(videoPath);
    const absoluteSubtitlePath = path.resolve(subtitlePath);
    const absoluteOutputPath = path.resolve(outputPath);
    
    // Проверяем существование файлов
    if (!await fs.pathExists(absoluteVideoPath)) {
      throw new Error(`Видеофайл не найден: ${absoluteVideoPath}`);
    }
    
    if (!await fs.pathExists(absoluteSubtitlePath)) {
      throw new Error(`Файл субтитров не найден: ${absoluteSubtitlePath}`);
    }

    // Настройки стиля субтитров по умолчанию
    const defaultOptions = {
      fontName: 'Montserrat',
      fontSize: 8,
      fontColor: 'white',
      backgroundColor: 'black@0.7',
      position: 'bottom',
      alignment: 2,  // bottom center (ASS format)
      marginV: 220,  // отступ от низа в пикселях
      borderWidth: 1,
      borderColor: 'black'
    };

    const styleOptions = { ...defaultOptions, ...options };
    
    // На Windows проще всего скопировать SRT в ту же директорию что и видео
    // и использовать только имя файла без пути
    const videoDir = path.dirname(absoluteVideoPath);
    const subtitleBasename = path.basename(absoluteSubtitlePath);
    const localSubtitlePath = path.join(videoDir, 'temp_subtitles.srt');
    
    // Копируем субтитры во временный файл рядом с видео
    await fs.copy(absoluteSubtitlePath, localSubtitlePath);
    
    console.log(`  - Шрифт: ${styleOptions.fontName} ${styleOptions.fontSize}pt`);
    console.log(`  - Позиция: ${styleOptions.position}, выравнивание: ${styleOptions.alignment}`);
    console.log(`  - Отступ снизу: ${styleOptions.marginV}px`);
    
    // Формируем строку стилей для FFmpeg
    const styleString = `FontName=${styleOptions.fontName},FontSize=${styleOptions.fontSize},MarginV=${styleOptions.marginV},Alignment=${styleOptions.alignment}`;
    
    // Используем фильтр с принудительным применением стиля
    const subtitleFilter = `subtitles=temp_subtitles.srt:force_style='${styleString}'`;
    console.log(`  - Фильтр субтитров: ${subtitleFilter}`);
    
    // Запускаем FFmpeg из директории с видео
    await execa(ffmpegPath, [
      '-i', path.basename(absoluteVideoPath),
      '-vf', subtitleFilter,
      '-c:a', 'copy',  // копируем аудио без перекодирования
      '-c:v', 'libx264',  // перекодируем видео для совместимости
      '-preset', 'fast',  // быстрое кодирование
      '-crf', '23',  // качество видео
      '-y',  // перезаписать выходной файл
      path.basename(absoluteOutputPath)
    ], {
      cwd: videoDir,  // Работаем из директории с видео
      timeout: 300000  // 5 минут таймаут
    });
    
    // Удаляем временный файл субтитров
    await fs.remove(localSubtitlePath);

    console.log(`✅ Субтитры наложены: ${outputPath}`);
    return outputPath;

  } catch (error) {
    console.error(`❌ Ошибка наложения субтитров:`, error);
    throw error;
  }
}

/**
 * Создает фильтр субтитров для FFmpeg
 * @param {string} subtitleFilename - имя файла субтитров (без пути)
 * @returns {string} - строка фильтра для FFmpeg
 */
function createSubtitleFilter(subtitleFilename) {
  // Простой фильтр с именем файла - работает когда SRT в той же директории
  return `subtitles=${subtitleFilename}`;
}

/**
 * Создает простой фильтр субтитров без сложных стилей (fallback)
 * @param {string} subtitlePath - путь к SRT файлу
 * @returns {string} - простой фильтр субтитров
 */
export function createSimpleSubtitleFilter(subtitlePath) {
  const absolutePath = path.resolve(subtitlePath);
  const escapedPath = absolutePath.replace(/\\/g, '/').replace(/:/g, '\\:');
  return `subtitles='${escapedPath}'`;
}

/**
 * Проверяет, поддерживает ли FFmpeg фильтр субтитров
 * @param {string} ffmpegPath - путь к FFmpeg
 * @returns {Promise<boolean>}
 */
export async function checkSubtitleSupport(ffmpegPath) {
  try {
    const { stdout } = await execa(ffmpegPath, ['-filters']);
    return stdout.includes('subtitles');
  } catch (error) {
    console.error('❌ Ошибка проверки поддержки субтитров:', error);
    return false;
  }
}

/**
 * Получает информацию о видеофайле
 * @param {string} videoPath - путь к видеофайлу
 * @param {string} ffmpegPath - путь к FFmpeg
 * @returns {Promise<Object>} - информация о видео
 */
export async function getVideoInfo(videoPath, ffmpegPath) {
  try {
    const { stderr } = await execa(ffmpegPath, [
      '-i', videoPath,
      '-f', 'null',
      '-'
    ], {
      reject: false
    });

    // Извлекаем разрешение видео
    const resolutionMatch = stderr.match(/(\d{3,4})x(\d{3,4})/);
    const durationMatch = stderr.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/);
    
    const info = {
      width: resolutionMatch ? parseInt(resolutionMatch[1]) : 1920,
      height: resolutionMatch ? parseInt(resolutionMatch[2]) : 1080,
      duration: 0
    };

    if (durationMatch) {
      const hours = parseInt(durationMatch[1]);
      const minutes = parseInt(durationMatch[2]);
      const seconds = parseFloat(durationMatch[3]);
      info.duration = hours * 3600 + minutes * 60 + seconds;
    }

    return info;
    
  } catch (error) {
    console.error('❌ Ошибка получения информации о видео:', error);
    return { width: 1920, height: 1080, duration: 0 };
  }
}
