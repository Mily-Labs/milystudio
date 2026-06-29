# Contributing to MilyStudio

Спасибо за интерес к проекту. Этот документ — короткий гайд для тех, кто хочет поднять студию локально или прислать изменение.

## Что внутри

MilyStudio — это монорепо из четырёх модулей:

| Модуль | Назначение |
| --- | --- |
| `ffmpeg/` | Медиа-движок и Node-воркеры (транскод, субтитры, whisper) |
| `OmniVoice/` | AI-ядро: TTS, клонирование голоса, ASR, дубляж (Python + bun) |
| `text-to-lottie/` | Генерация и плеер Lottie-анимаций |
| `studio/` | Единый интерфейс управления (Node-оркестратор + React SPA) |

Каждый модуль живёт самостоятельно, но оркестратор `studio/` умеет поднимать любой из них как подпроцесс и смотреть логи.

## Prerequisites

* **Node.js ≥ 20** (для `studio/`, `ffmpeg/`, `text-to-lottie/`)
* **bun** (для `OmniVoice/`)
* **uv** + **Python 3.10+** (для `OmniVoice/`; WhisperX, TTS-модели)
* **ffmpeg.exe** (должен лежать в `ffmpeg/ffmpeg.exe`; путь переопределяется через env `FFMPEG_PATH`)

## Поднять студию

```bash
# 1. Установить зависимости всех модулей
npm --prefix ffmpeg install
npm --prefix text-to-lottie install
npm --prefix studio install          # ставит server + web через workspace
npm --prefix studio/web install

# 2. (опционально) подготовить OmniVoice
cd OmniVoice
uv sync
bun run setup:api
cd ..

# 3. Запустить студию (оркестратор :4100 + web :5174)
npm --prefix studio run dev
```

Подробности по prod-сборке и портам — в [`studio/README.md`](./studio/README.md).

## Соглашения

* **TypeScript** везде, кроме `OmniVoice/` (там Python). Без `any`, где можно.
* **Коммиты** — Conventional Commits: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`. Scope — имя модуля в скобках, например `feat(studio): add omniVoice tab`.
* **Никаких секретов** в репо. Реальные `.env` — в гитигноре, в репо только `.env.example`.
* **Не трогать** `ffmpeg/`, `OmniVoice/`, `text-to-lottie/`, `.agents/`, `skills-lock.json` без явной причины — это контрактные подсистемы.

## Pull Request

1. Сделай ветку от `main`.
2. Локально проверь, что `npm --prefix studio run lint` проходит без ошибок.
3. Опиши в PR, **что** меняется и **зачем**. Если меняешь API оркестратора — приложи пример запроса.

## Лицензия

Присылая изменения, ты соглашаешься на распространение под [MIT](./LICENSE).
