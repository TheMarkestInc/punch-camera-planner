# BATYR QUEST / Camera Scout

[Открыть просмотрщик](https://themarkestinc.github.io/punch-camera-planner/)

Браузерная локация PUNCH для съёмочной команды: свободное перемещение по залу и второму этажу, подбор объектива и сохранение ракурсов. Работает как статическая страница на GitHub Pages, без сервера приложения, регистрации и внешних CDN.

Клавиши WASD перемещают камеру, Q/E меняют высоту, Shift ускоряет полёт. Удерживайте правую кнопку мыши для поворота. На телефоне используйте режим «Облёт» и жесты одним или двумя пальцами.

Выберите фокусное расстояние, сенсор и формат кадра. Углы обзора рассчитываются по физическому размеру сенсора с обрезкой под формат. Сохранённые ракурсы можно передать ссылкой или JSON-файлом, кадр — скачать в PNG. Диафрагма и дистанция используются для расчёта ГРИП; размытие не имитируется. Освещение адаптировано для просмотра геометрии в браузере.

3D-версия включает оба уровня, сцену с DnD-столом, узор V9 и пять стульев. Публичный репозиторий содержит только веб-приложение и подготовленные браузерные ресурсы. Источники материалов перечислены в `public/assets/attributions.json`.

## Разработка и публикация

Static camera planning app for the PUNCH location. All runtime code and venue assets are served from the same origin. No backend or runtime CDN is required.

```powershell
npm ci
npm test
npm run dev
npm run build
```

Vite serves the app at `/punch-camera-planner/`. Set `PAGES_BASE_PATH` before building to deploy to another path (for example `/` for a custom domain). Publish the contents of `dist/`, not the source folder.

`public/assets/venue.glb` is exported from the native venue scene. The app supports `EXT_meshopt_compression` and WebP textures. `public/assets/scene-metadata.json` defines:

```json
{
  "modelFile": "venue.glb",
  "modelBytes": 123456,
  "units": "metres",
  "up": "Y",
  "presets": [{"id":"stage","label":"Сцена","position":[0,1.6,4],"target":[0,1.2,0],"floor":"ground","focal":24}],
  "floorLevels": [{"id":"ground","label":"Основной зал","height":0}],
  "bounds": {"min":[-4,0,-3],"max":[4,5,13]},
  "suggestedExposure": 1
}
```

Coordinates and floor heights are in metres, with Y up. The exporter defines placement and view direction. A centered output gate is cropped inside the physical sensor; changing aspect ratio never stretches the room. FOV uses the cropped gate and focal length. Depth of field is an optical estimate with a sensor-diagonal / 1500 circle of confusion; blur is not simulated.

Furniture and ceiling toggles identify nodes by `extras.kind = furniture | prop | ceiling | roof`, with conservative native label fallbacks. Native punctual lights are retained, up to 24; shadow maps are disabled for browser performance. A low-intensity studio environment adds readable ambient light. Exposure can be adjusted in the UI.

Views are saved in localStorage. JSON export omits thumbnails. Share links contain the validated camera state in the URL hash. PNG exports use the selected output aspect at 1920 px wide. Desktop navigation supports WASD, Q/E, Shift, right-drag look and wheel dolly. Orbit controls support mouse and touch.

For automated browser QA, `window.__BATYR_CAMERA__` is created after model loading and shader compilation. It exposes `sceneReady`, `getState()`, `applyState(state)`, `snapshot(options)`, `getStats()`, `setPreset(id)` and read-only `metadata`, `camera`, `scene` properties. This API is for verification; the app does not depend on it.
