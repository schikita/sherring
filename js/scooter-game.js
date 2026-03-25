/**
 * «Самокатчик» — игра в духе ПДД для самокатов (Беларусь).
 *
 * СЕЙЧАС: отрисовка примитивами на Canvas (без PNG).
 * Для визуального уровня продакшена понадобятся спрайты (рекомендуемые размеры — кратные @2x):
 *
 * --- ПЕРСОНАЖИ И ТРАНСПОРТ ---
 * • scooter_idle.png / scooter_ride.png — самокатчик в профиль, 64×48…96×72 px
 * • scooter_walk.png — тот же герой пешком (спешился), 48×64 px
 * • pedestrian_walk_01…04.png — цикл шагов пешехода, 40×56 px (4 кадра)
 *
 * --- ДОРОГА И ИНФРАСТРУКТУРА ---
 * • road_tile.png — бесшовная текстура асфальта + разметка, 256×256 (tiling)
 * • assets/sprites/road.png — полоса перекрёстка поперёк движения (на всю ширину кадра)
 * • lane_marking.png — пунктир центра полосы, 64×32
 * • sidewalk_tile.png — тротуар по краям (опционально)
 *
 * --- СВЕТОФОР (только перед перекрёстком) ---
 * • red.png / yellow.png / green.png — сигналы (жёлтый: стой; зелёный: можно)
 * • auto-left.png — авто справа налево (на красном); auto-right.png — слева направо
 *
 * --- ЗНАКИ ---
 * • sign_dismount.png — «спешиться» / велосипедист, 64×64
 * • sign_zone_end.png — конец зоны (опционально)
 *
 * --- ЗОНЫ И ОБЪЕКТЫ ---
 * • zone_dismount_strip.png — полупрозрачная подсветка полосы «можно не спешиваться»
 * • energy.png — станция зарядки (assets/sprites/energy.png)
 * • manhole_closed.png / manhole_open.png — люк, 48×48
 *
 * --- UI / ЭФФЕКТЫ ---
 * • ui_battery.png — иконка батареи + шкала (9-slice)
 * • ui_fine_stamp.png — штамп «штраф» для всплывающего эффекта
 * • particles_spark.png — искры при наезде на люк (опционально)
 *
 * Формат: PNG с альфой; для анимаций — листы по строкам или Aseprite JSON.
 *
 * Игрок (текущий набор):
 * • assets/sprites/player.png — прямо / пешком
 * • assets/sprites/player-left.png — наклон влево (смена полосы)
 * • assets/sprites/player-right.png — наклон вправо
 * • assets/sprites/luk.png — канализационный люк
 * • assets/sprites/promo.jpg — заставка до «Начать игру» (грузится при появлении секции #game в зоне просмотра)
 * Пешеходы — вдоль основной полосы (dist), не на перекрёстке с авто; 4 модели + offset:
 * • walker-N-left.png / walker-N-right.png — направление вдоль тротуара (N = 1…4)
 */
(function () {
  "use strict";

  var root = document.getElementById("scooterGameRoot");
  if (!root) return;

  var canvas = document.getElementById("scooterGameCanvas");
  var ctx = canvas && canvas.getContext("2d");
  if (!ctx) return;

  function getSiteRootHref() {
    var el = document.querySelector('script[src*="scooter-game"]');
    if (!el) return new URL("./", window.location.href).href;
    var raw = el.getAttribute("src");
    if (!raw) return new URL("./", window.location.href).href;
    try {
      var abs = new URL(raw, window.location.href);
      return abs.href.replace(/\/js\/scooter-game\.js(\?.*)?$/i, "/");
    } catch (e) {
      return new URL("./", window.location.href).href;
    }
  }

  function resolveAsset(rel) {
    if (!rel || /^(https?:|data:|\/\/)/i.test(rel)) return rel;
    var t = rel.replace(/^\.\//, "");
    try {
      return new URL(t, getSiteRootHref()).href;
    } catch (e2) {
      return rel;
    }
  }

  function spriteRedraw() {
    render();
  }

  var playerSprites = {
    center: null,
    left: null,
    right: null,
  };

  var manholeSprite = null;
  var energySprite = null;
  /** Перекрёсток: текстура поперёк движения */
  var roadCrossSprite = null;
  var promoSprite = null;
  /** Индекс 0…3 = пешеходы 1…4; у каждого left / right под направление движения */
  var walkerSprites = [
    { left: null, right: null },
    { left: null, right: null },
    { left: null, right: null },
    { left: null, right: null },
  ];

  var tlSprites = { red: null, yellow: null, green: null };
  var autoSprites = { left: null, right: null };

  function loadPlayerSprites() {
    var list = [
      ["center", "assets/sprites/player.png"],
      ["left", "assets/sprites/player-left.png"],
      ["right", "assets/sprites/player-right.png"],
    ];
    list.forEach(function (item) {
      var key = item[0];
      var src = resolveAsset(item[1]);
      var img = new Image();
      img.onload = function () {
        playerSprites[key] = img;
        spriteRedraw();
      };
      img.onerror = function () {
        playerSprites[key] = null;
        spriteRedraw();
      };
      img.src = src;
    });
  }

  function loadManholeSprite() {
    var img = new Image();
    img.onload = function () {
      manholeSprite = img;
      spriteRedraw();
    };
    img.onerror = function () {
      manholeSprite = null;
      spriteRedraw();
    };
    img.src = resolveAsset("assets/sprites/luk.png");
  }

  function loadEnergySprite() {
    var img = new Image();
    img.onload = function () {
      energySprite = img;
      spriteRedraw();
    };
    img.onerror = function () {
      energySprite = null;
      spriteRedraw();
    };
    img.src = resolveAsset("assets/sprites/energy.png");
  }

  function loadRoadCrossSprite() {
    var img = new Image();
    img.onload = function () {
      roadCrossSprite = img;
      spriteRedraw();
    };
    img.onerror = function () {
      roadCrossSprite = null;
      spriteRedraw();
    };
    img.src = resolveAsset("assets/sprites/road.png");
  }

  var promoImageLoadStarted = false;
  function loadPromoImage() {
    if (promoImageLoadStarted) return;
    promoImageLoadStarted = true;
    var img = new Image();
    img.onload = function () {
      promoSprite = img;
      spriteRedraw();
    };
    img.onerror = function () {
      promoSprite = null;
      spriteRedraw();
    };
    img.src = resolveAsset("assets/sprites/promo.jpg");
  }

  function loadWalkerSprites() {
    for (var n = 1; n <= 4; n++) {
      (function (idx) {
        var imgL = new Image();
        imgL.onload = function () {
          walkerSprites[idx].left = imgL;
          spriteRedraw();
        };
        imgL.onerror = function () {
          walkerSprites[idx].left = null;
          spriteRedraw();
        };
        imgL.src = resolveAsset(
          "assets/sprites/walker-" + (idx + 1) + "-left.png"
        );
        var imgR = new Image();
        imgR.onload = function () {
          walkerSprites[idx].right = imgR;
          spriteRedraw();
        };
        imgR.onerror = function () {
          walkerSprites[idx].right = null;
          spriteRedraw();
        };
        imgR.src = resolveAsset(
          "assets/sprites/walker-" + (idx + 1) + "-right.png"
        );
      })(n - 1);
    }
  }

  function loadTrafficAndAutoSprites() {
    ["red", "yellow", "green"].forEach(function (name) {
      var img = new Image();
      img.onload = function () {
        tlSprites[name] = img;
        spriteRedraw();
      };
      img.onerror = function () {
        tlSprites[name] = null;
        spriteRedraw();
      };
      img.src = resolveAsset("assets/sprites/" + name + ".png");
    });
    var imgL = new Image();
    imgL.onload = function () {
      autoSprites.left = imgL;
      spriteRedraw();
    };
    imgL.onerror = function () {
      autoSprites.left = null;
      spriteRedraw();
    };
    imgL.src = resolveAsset("assets/sprites/auto-left.png");
    var imgR = new Image();
    imgR.onload = function () {
      autoSprites.right = imgR;
      spriteRedraw();
    };
    imgR.onerror = function () {
      autoSprites.right = null;
      spriteRedraw();
    };
    imgR.src = resolveAsset("assets/sprites/auto-right.png");
  }

  var gameSpritesLoaded = false;
  function loadGameSprites() {
    if (gameSpritesLoaded) return;
    gameSpritesLoaded = true;
    loadPromoImage();
    loadPlayerSprites();
    loadManholeSprite();
    loadEnergySprite();
    loadRoadCrossSprite();
    loadWalkerSprites();
    loadTrafficAndAutoSprites();
  }

  /** Заставка promo.jpg — сразу при попадании секции игры в зону просмотра (остальные спрайты — по «Начать игру»). */
  var gameSection = document.getElementById("game");
  if (gameSection && "IntersectionObserver" in window) {
    var promoSectionObs = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          loadPromoImage();
          promoSectionObs.unobserve(entry.target);
        });
      },
      { root: null, rootMargin: "0px 0px 10% 0px", threshold: 0.02 }
    );
    promoSectionObs.observe(gameSection);
  }

  var hudScore = document.getElementById("scooterHudScore");
  var hudFines = document.getElementById("scooterHudFines");
  var hudBattery = document.getElementById("scooterHudBattery");
  var hudSpeed = document.getElementById("scooterHudSpeed");
  var hudMode = document.getElementById("scooterHudMode");
  var hudMsg = document.getElementById("scooterHudMsg");
  var btnStart = document.getElementById("scooterGameStart");
  var btnPause = document.getElementById("scooterGamePause");
  var overlay = document.getElementById("scooterGameOverlay");
  var overlayTitle = document.getElementById("scooterOverlayTitle");
  var overlayText = document.getElementById("scooterOverlayText");
  var overlayTextMobile = document.getElementById("scooterOverlayTextMobile");

  function setOverlayBody(text) {
    if (overlayText) overlayText.textContent = text;
    if (overlayTextMobile) overlayTextMobile.textContent = text;
  }

  var LANES = 3;
  /** Глобальный масштаб объектов, шрифтов и коллизий */
  var G = 1.5;
  /** Езда: быстрее движение по трассе и выше км/ч на HUD (пешком не меняется) */
  var RIDE_SPEED_MULT = 1.48;
  /** Перекрёсток: светофор на dist − lightAhead; жёлтый → зелёный; штраф только на красный */
  var CROSS_YELLOW_SEC = 2;
  var CROSS_GREEN_SEC = 5.5;
  var CROSS_CAR_SPEED_PX = 310;
  /** Светофор дальше от линии перекрёстка — больше места до «островка» */
  var CROSS_LIGHT_AHEAD = Math.round(148 * G);
  /** Зона красного: только на красный; жёлтый не штрафует (узкий участок перед стоп-линией) */
  var RED_ZONE_REL_MIN = -138 * G;
  var RED_ZONE_REL_MAX = 228 * G;
  /** Небольшой откат назад при торможении стоя */
  var REVERSE_SPEED_MULT = 0.22;
  /** Свайп по верхней зоне: мин. горизонтальное смещение (px) */
  var LANE_SWIPE_MIN_PX = 52;
  /** Пешеход ушёл под низ кадра — переспавн впереди (не трогаем «за горизонтом» впереди) */
  var PED_VIEW_PAD = 70;
  var PED_RECYCLE_REL = 135 * G;
  /** Мин. расстояние между люками по оси dist (не ставим рядом) */
  var MANHOLE_MIN_GAP = 420 * G;
  /** Половина «толщины» перекрёстка по dist — там едут авто, пешеходы не ходят */
  var CROSS_CAR_ROAD_HALF = 120 * G;
  var keysHeld = {};
  /** Сенсор: нижняя зона канваса — газ (центр) / тормоз (углы); brakeBtn — кнопка «Тормоз». */
  var touchDrive = { gas: false, brake: false, brakeBtn: false };
  /** Жест смены полосы: старт в верхней зоне канваса */
  var laneGesture = null;
  var COLORS = {
    road: "#2a2d3a",
    lane: "rgba(255,255,255,0.22)",
    grass: "#0f1218",
    scooter: "#6ee7ff",
    scooterWalk: "#a78bfa",
    ped: "#f4b8c5",
    manhole: "#1a1c24",
    manholeRing: "#4a4f62",
    charge: "rgba(74, 222, 128, 0.35)",
    red: "#f87171",
    yellow: "#fbbf24",
    green: "#4ade80",
  };

  var state = {
    running: false,
    paused: false,
    t: 0,
    lastTs: 0,
    score: 0,
    fines: 0,
    battery: 100,
    throttle: 0,
    dismounted: false,
    playerLane: 1,
    targetLane: 1,
    laneVisual: 1,
    dist: 0,
    scroll: 140,
    entities: [],
    spawnTimer: 0,
    violationMeter: 0,
    strikeFlash: 0,
    fineFlash: 0,
    msgTimer: 0,
    lastMsg: "",
    gameOver: false,
    redZoneActive: false,
  };

  function setMsg(text, dur) {
    state.lastMsg = text;
    state.msgTimer = dur || 2;
    if (hudMsg) hudMsg.textContent = text;
  }

  function resize() {
    var rect = root.getBoundingClientRect();
    var w = Math.min(920, Math.max(280, rect.width));
    var h = Math.round((w * 9) / 16);
    if (typeof window !== "undefined" && window.innerHeight > 320) {
      var vh = window.visualViewport
        ? window.visualViewport.height
        : window.innerHeight;
      var maxH = Math.max(220, vh * 0.4);
      if (h > maxH) {
        h = Math.round(maxH);
        w = Math.round((h * 16) / 9);
        w = Math.min(920, Math.max(280, w));
      }
    }
    canvas.width = w * devicePixelRatio;
    canvas.height = h * devicePixelRatio;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  }

  function laneCenterX(lane, w) {
    var margin = w * 0.08;
    var roadW = w - margin * 2;
    var lw = roadW / LANES;
    return margin + lw * (lane + 0.5);
  }

  function laneWidthPx(w) {
    return (w * 0.84) / LANES;
  }

  function spawnCrossCars(e, w) {
    var n = 2 + (Math.random() < 0.45 ? 1 : 0);
    e.cars = [];
    for (var i = 0; i < n; i++) {
      var dir = Math.random() < 0.5 ? -1 : 1;
      var gap = i * (88 + Math.random() * 55);
      e.cars.push({
        dir: dir,
        x: dir < 0 ? w + 55 + gap : -55 - gap,
        dy: ((i % 3) - 1) * 11 * G,
      });
    }
  }

  function intersectionUpdate(e, dt, w) {
    if (e.type !== "crossRoad") return;
    if (!e.cars) e.cars = [];
    if (e.lightAhead == null) e.lightAhead = CROSS_LIGHT_AHEAD;
    var spd = CROSS_CAR_SPEED_PX * G;

    if (e.phase === "red") {
      e.phaseT += dt;
      if (e.cars.length === 0 && !e.carsSpawned) {
        spawnCrossCars(e, w);
        e.carsSpawned = true;
      }
      if (e.cars.length > 0) {
        for (var ci = e.cars.length - 1; ci >= 0; ci--) {
          var c = e.cars[ci];
          c.x += c.dir * spd * dt;
          if (c.x < -220 || c.x > w + 220) e.cars.splice(ci, 1);
        }
      } else if (e.carsSpawned && e.phaseT > 0.35) {
        e.phase = "yellow";
        e.phaseT = 0;
      }
    } else if (e.phase === "yellow") {
      e.phaseT += dt;
      if (e.phaseT >= CROSS_YELLOW_SEC) {
        e.phase = "green";
        e.phaseT = 0;
        e.cars = [];
        e.carsSpawned = false;
      }
    } else if (e.phase === "green") {
      e.phaseT += dt;
      if (e.phaseT >= CROSS_GREEN_SEC) {
        e.phase = "red";
        e.phaseT = 0;
        e.carsSpawned = false;
        e.cars = [];
      }
    }
  }

  function spawnEntity() {
    var roll = Math.random();
    var lane = Math.floor(Math.random() * LANES);
    var base = state.dist + Math.round(520 * G + Math.random() * 220 * G);

    if (roll < 0.28) {
      state.entities.push({
        type: "crossRoad",
        dist: base,
        phase: "red",
        phaseT: 0,
        lightAhead: CROSS_LIGHT_AHEAD,
        cars: [],
        carsSpawned: false,
      });
    } else if (roll < 0.44) {
      state.entities.push({
        type: "charger",
        lane: lane,
        dist: base,
        len: Math.round(100 * G),
      });
    } else if (roll < 0.58) {
      var baseM = base;
      var laneM = lane;
      var triesM = 0;
      while (triesM < 18) {
        var clearM = true;
        for (var mi = 0; mi < state.entities.length; mi++) {
          var em = state.entities[mi];
          if (
            em.type === "manhole" &&
            Math.abs(em.dist - baseM) < MANHOLE_MIN_GAP
          ) {
            clearM = false;
            break;
          }
        }
        if (clearM) break;
        baseM =
          state.dist +
          Math.round(560 * G + triesM * 95 * G + Math.random() * 240 * G);
        laneM = Math.floor(Math.random() * LANES);
        triesM++;
      }
      state.entities.push({
        type: "manhole",
        lane: laneM,
        dist: baseM,
      });
    } else {
      state.entities.push({
        type: "pedestrian",
        lane: lane,
        dist: pickPedSpawnDist(base),
        walkAlong: Math.random() < 0.5 ? 1 : -1,
        walkSpeed: 20 + Math.random() * 20,
        side: Math.random() < 0.5 ? -1 : 1,
        offset: 0,
        variant: 1 + Math.floor(Math.random() * 4),
      });
    }
  }

  function addFine(reason, amount) {
    state.fines += amount;
    state.fineFlash = 0.6;
    state.score = Math.max(0, state.score - amount * 8);
    setMsg("Штраф: " + reason, 2.5);
    if (hudFines) hudFines.textContent = String(state.fines);
  }

  function playerKmh() {
    if (state.dismounted) return Math.round(4 + state.throttle * 5);
    return Math.round(2 + state.throttle * (21 * RIDE_SPEED_MULT));
  }

  function moveMultiplier() {
    var m =
      state.throttle * (state.dismounted ? 0.42 : RIDE_SPEED_MULT);
    return m < 0.02 ? 0 : m;
  }

  function inRedLightViolation() {
    return (
      state.redZoneActive &&
      !state.dismounted &&
      (state.throttle > 0.2 || playerKmh() > 10)
    );
  }

  function update(dt) {
    if (state.gameOver || state.paused) return;

    var wPlay = canvas.width / devicePixelRatio;
    var hPlay = canvas.height / devicePixelRatio;

    state.t += dt;

    var acc = 2.8;
    if (state.dismounted) state.throttle = Math.min(state.throttle, 0.55);
    var touchBrake = touchDrive.brake || touchDrive.brakeBtn;
    if (keysHeld.KeyS || keysHeld.ArrowDown || touchBrake) {
      state.throttle = Math.max(0, state.throttle - dt * acc);
    } else if (keysHeld.KeyW || keysHeld.ArrowUp || touchDrive.gas) {
      state.throttle = Math.min(1, state.throttle + dt * acc);
    } else if (
      !keysHeld.KeyW &&
      !keysHeld.ArrowUp &&
      !keysHeld.KeyS &&
      !keysHeld.ArrowDown &&
      !touchDrive.gas
    ) {
      state.throttle = Math.max(0, state.throttle - dt * 0.45);
    }

    var move = moveMultiplier();
    state.dist += state.scroll * dt * move;
    if (
      move < 0.04 &&
      (keysHeld.KeyS || keysHeld.ArrowDown || touchBrake) &&
      state.throttle < 0.08
    ) {
      state.dist -= state.scroll * dt * REVERSE_SPEED_MULT;
      if (state.dist < 0) state.dist = 0;
    }
    state.score += state.scroll * dt * 0.18 * move;
    if (state.msgTimer > 0) state.msgTimer -= dt;
    if (state.msgTimer <= 0 && hudMsg) hudMsg.textContent = "";

    var drain =
      2.2 *
      dt *
      (state.dismounted ? 0.28 : 1) *
      (0.2 + state.throttle * 0.85);
    state.battery -= drain;
    if (state.battery <= 0) {
      state.battery = 0;
      endGame("Батарея села. Подзарядитесь на станциях!");
      return;
    }

    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      spawnEntity();
      state.spawnTimer = 0.9 + Math.random() * 1.1;
    }

    state.laneVisual += (state.targetLane - state.laneVisual) * Math.min(1, dt * 8);
    if (Math.abs(state.targetLane - state.playerLane) < 0.01)
      state.playerLane = state.targetLane;

    state.redZoneActive = false;

    var playerDist = state.dist;
    var manholeHit = false;
    var pedHit = false;
    var charging = false;
    var pl = Math.round(state.laneVisual);

    for (var i = state.entities.length - 1; i >= 0; i--) {
      var e = state.entities[i];
      var rel = e.dist - playerDist;

      if (e.type === "crossRoad") {
        intersectionUpdate(e, dt, wPlay);
        if (
          e.phase === "red" &&
          rel > RED_ZONE_REL_MIN &&
          rel < RED_ZONE_REL_MAX
        ) {
          state.redZoneActive = true;
        }
      }

      if (e.type === "pedestrian") {
        e.dist += (e.walkAlong || 1) * (e.walkSpeed || 26) * dt;
        e.offset += e.side * 22 * dt * G;
        var roadMx = wPlay * 0.08;
        var roadRw = wPlay * 0.84;
        var edgePad = 16 * G;
        var minPedX = roadMx + edgePad;
        var maxPedX = roadMx + roadRw - edgePad;
        var lcPed =
          laneCenterX(
            e.lane != null && e.lane >= 0 ? e.lane : 1,
            wPlay
          );
        var pedCx = lcPed + (e.offset || 0);
        if (pedCx < minPedX) {
          e.offset = minPedX - lcPed;
          e.side = 1;
          pedCx = minPedX;
        } else if (pedCx > maxPedX) {
          e.offset = maxPedX - lcPed;
          e.side = -1;
          pedCx = maxPedX;
        }
        nudgePedOffCrossRoads(e);
        rel = e.dist - playerDist;
        var plCx = laneCenterX(pl, wPlay);
        if (
          Math.abs(rel) < 40 * G &&
          Math.abs(pedCx - plCx) < 30 * G &&
          !state.dismounted
        ) {
          pedHit = true;
        }
        var yPed = worldY(rel, hPlay);
        if (rel < -PED_RECYCLE_REL || yPed > hPlay + PED_VIEW_PAD) {
          e.dist = pickPedSpawnDist(
            playerDist + Math.round(380 * G + Math.random() * 320 * G)
          );
          e.lane = Math.floor(Math.random() * LANES);
          e.walkAlong = Math.random() < 0.5 ? 1 : -1;
          e.walkSpeed = 20 + Math.random() * 20;
          e.side = Math.random() < 0.5 ? -1 : 1;
          e.offset = 0;
          e.variant = 1 + Math.floor(Math.random() * 4);
          rel = e.dist - playerDist;
        }
      }

      if (e.type === "manhole" && Math.abs(rel) < 44 * G && e.lane === pl) {
        manholeHit = true;
      }

      if (e.type === "charger") {
        var onPad =
          e.lane === pl && Math.abs(rel) < e.len * 0.55;
        if (onPad) {
          charging = true;
          state.battery = Math.min(100, state.battery + 42 * dt);
          if (state.battery >= 100) {
            state.entities.splice(i, 1);
            continue;
          }
        }
      }

      if (rel < -280 * G && e.type !== "pedestrian")
        state.entities.splice(i, 1);
    }

    if (checkPlayerHitByCrossCars(wPlay, hPlay, playerDist, pl)) {
      state.strikeFlash = 0.6;
      endGame(
        "Вас сбила машина. (Начать заново)",
        "Проиграли!"
      );
      return;
    }

    if (pedHit) {
      addFine("опасность пешеходу", 6);
      state.strikeFlash = 0.5;
      state.entities = state.entities.filter(function (x) {
        return (
          x.type !== "pedestrian" ||
          Math.abs(x.dist - playerDist) > 110 * G
        );
      });
    }

    if (inRedLightViolation()) {
      state.violationMeter += dt;
      if (state.violationMeter > 0.45) {
        state.violationMeter = 0;
        addFine("красный свет", 3);
      }
    } else state.violationMeter *= 0.92;

    if (manholeHit) {
      state.strikeFlash = 0.5;
      endGame(
        "Вы провалились в люк. (Начать заново)",
        "Проиграли!"
      );
      return;
    }

    if (charging) setMsg("Зарядка…", 0.3);

    if (state.strikeFlash > 0) state.strikeFlash = Math.max(0, state.strikeFlash - dt * 1.8);
    if (state.fineFlash > 0) state.fineFlash = Math.max(0, state.fineFlash - dt * 1.8);

    if (state.fines >= 80) {
      endGame("Слишком много штрафов. Остановитесь и перечитайте правила!");
    }

    if (hudScore) hudScore.textContent = String(Math.floor(state.score));
    if (hudBattery) hudBattery.textContent = Math.round(state.battery) + "%";
    if (hudSpeed) hudSpeed.textContent = String(Math.round(playerKmh()));
    if (hudMode)
      hudMode.textContent = state.dismounted ? "Пешком" : "Самокат";
  }

  function drawRoad(w, h) {
    ctx.fillStyle = COLORS.grass;
    ctx.fillRect(0, 0, w, h);
    var mx = w * 0.08;
    var rw = w * 0.84;
    ctx.fillStyle = COLORS.road;
    ctx.fillRect(mx, 0, rw, h);
    var lw = rw / LANES;
    ctx.strokeStyle = COLORS.lane;
    ctx.lineWidth = Math.max(2, 2 * G);
    var dashSeg = 14 * G;
    ctx.setLineDash([dashSeg, dashSeg]);
    var dashPeriod = dashSeg * 2;
    var laneScroll = state.dist * 0.42 * G;
    ctx.lineDashOffset =
      ((laneScroll % dashPeriod) + dashPeriod) % dashPeriod;
    for (var i = 1; i < LANES; i++) {
      var x = mx + lw * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
  }

  function drawTrafficLightSprite(w, h, y, phase) {
    var lx = w * 0.865;
    var img =
      phase === "red"
        ? tlSprites.red
        : phase === "yellow"
          ? tlSprites.yellow
          : tlSprites.green;
    var sh = 46 * G;
    if (img && img.naturalWidth > 0) {
      var sw = sh * (img.naturalWidth / img.naturalHeight);
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, lx - sw * 0.5, y - sh * 0.88, sw, sh);
      ctx.restore();
    } else {
      ctx.fillStyle = "#2d3142";
      ctx.fillRect(lx - 7 * G, y - 62 * G, 14 * G, 68 * G);
      var c =
        phase === "red"
          ? COLORS.red
          : phase === "yellow"
            ? COLORS.yellow
            : COLORS.green;
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(lx, y - 44 * G, 9 * G, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCrossRoadStrip(w, h, yCenter) {
    var img = roadCrossSprite;
    var stripH = Math.min(h * 0.28, Math.max(58 * G, h * 0.14));
    if (img && img.naturalWidth > 0) {
      var ar = img.naturalWidth / img.naturalHeight;
      var fromAr = w / ar;
      stripH = Math.max(40 * G, Math.min(h * 0.26, fromAr));
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, 0, yCenter - stripH * 0.5, w, stripH);
      ctx.restore();
    } else {
      ctx.fillStyle = "#3a3f52";
      ctx.fillRect(0, yCenter - stripH * 0.5, w, stripH);
      ctx.fillStyle = "rgba(255,255,255,0.14)";
      ctx.fillRect(0, yCenter - stripH * 0.5, w, Math.max(2, 2 * G));
      ctx.fillRect(0, yCenter + stripH * 0.5 - Math.max(2, 2 * G), w, Math.max(2, 2 * G));
    }
  }

  function drawCrossRoads(w, h) {
    var cross = [];
    for (var ci = 0; ci < state.entities.length; ci++) {
      if (state.entities[ci].type === "crossRoad") cross.push(state.entities[ci]);
    }
    cross.sort(function (a, b) {
      return (b.dist - state.dist) - (a.dist - state.dist);
    });
    for (var j = 0; j < cross.length; j++) {
      var e = cross[j];
      var rel = e.dist - state.dist;
      var y = worldY(rel, h);
      drawCrossRoadStrip(w, h, y);

      if (e.phase === "red" && e.cars && e.cars.length) {
        for (var cj = 0; cj < e.cars.length; cj++) {
          var c = e.cars[cj];
          var aimg = c.dir < 0 ? autoSprites.left : autoSprites.right;
          var carH = 28 * G;
          var carW = carH * 2.1;
          if (aimg && aimg.naturalWidth > 0) {
            carW = carH * (aimg.naturalWidth / aimg.naturalHeight);
          }
          ctx.save();
          ctx.imageSmoothingEnabled = true;
          if (aimg && aimg.naturalWidth > 0) {
            ctx.drawImage(
              aimg,
              c.x - carW * 0.5,
              y + c.dy - carH * 0.55,
              carW,
              carH
            );
          } else {
            ctx.fillStyle = "#94a3b8";
            ctx.fillRect(
              c.x - carW * 0.5,
              y + c.dy - carH * 0.55,
              carW,
              carH * 0.85
            );
          }
          ctx.restore();
        }
      }

      var la = e.lightAhead != null ? e.lightAhead : CROSS_LIGHT_AHEAD;
      var relL = rel - la;
      var yL = worldY(relL, h);
      drawTrafficLightSprite(w, h, yL, e.phase || "red");
    }
  }

  function worldY(d, h) {
    return h * 0.72 - d * 0.42 * G;
  }

  function getCarDrawMetrics(c) {
    var carH = 28 * G;
    var carW = carH * 2.1;
    var aimg = c.dir < 0 ? autoSprites.left : autoSprites.right;
    if (aimg && aimg.naturalWidth > 0) {
      carW = carH * (aimg.naturalWidth / aimg.naturalHeight);
    }
    return { w: carW, h: carH };
  }

  function isPedDistOnCarCross(d) {
    var half = CROSS_CAR_ROAD_HALF;
    for (var qi = 0; qi < state.entities.length; qi++) {
      var cr = state.entities[qi];
      if (cr.type === "crossRoad" && Math.abs(d - cr.dist) < half) {
        return true;
      }
    }
    return false;
  }

  function pickPedSpawnDist(baseDist) {
    var d = baseDist;
    for (var tries = 0; tries < 32; tries++) {
      if (!isPedDistOnCarCross(d)) return d;
      d =
        state.dist +
        Math.round(400 * G + tries * 85 * G + Math.random() * 300 * G);
    }
    return d;
  }

  function nudgePedOffCrossRoads(ped) {
    var half = CROSS_CAR_ROAD_HALF + 10 * G;
    var pad = 10 * G;
    for (var round = 0; round < 5; round++) {
      var moved = false;
      for (var qi = 0; qi < state.entities.length; qi++) {
        var cr = state.entities[qi];
        if (cr.type !== "crossRoad") continue;
        var delta = ped.dist - cr.dist;
        if (Math.abs(delta) >= half) continue;
        if (delta >= 0) ped.dist = cr.dist + half + pad;
        else ped.dist = cr.dist - half - pad;
        ped.walkAlong = (ped.walkAlong || 1) > 0 ? -1 : 1;
        moved = true;
      }
      if (!moved) break;
    }
  }

  function checkPlayerHitByCrossCars(wPlay, hPlay, playerDist, lanePl) {
    var pxP = laneCenterX(lanePl, wPlay);
    var pyP = worldY(0, hPlay);
    var pHalfW = 24 * G;
    var pTop = pyP - 52 * G;
    var pBot = pyP + 10 * G;
    var plL = pxP - pHalfW;
    var plR = pxP + pHalfW;
    for (var ie = 0; ie < state.entities.length; ie++) {
      var cr = state.entities[ie];
      if (
        cr.type !== "crossRoad" ||
        cr.phase !== "red" ||
        !cr.cars ||
        !cr.cars.length
      ) {
        continue;
      }
      var relC = cr.dist - playerDist;
      var yCross = worldY(relC, hPlay);
      for (var ic = 0; ic < cr.cars.length; ic++) {
        var c = cr.cars[ic];
        var m = getCarDrawMetrics(c);
        var cl = c.x - m.w * 0.5;
        var crgt = c.x + m.w * 0.5;
        var ct = yCross + c.dy - m.h * 0.55;
        var cb = ct + m.h;
        if (crgt < plL || cl > plR || cb < pTop || ct > pBot) continue;
        return true;
      }
    }
    return false;
  }

  function pickPlayerImage() {
    if (state.dismounted) {
      if (playerSprites.center && playerSprites.center.naturalWidth) {
        return playerSprites.center;
      }
      if (playerSprites.left && playerSprites.left.naturalWidth) {
        return playerSprites.left;
      }
      return playerSprites.right;
    }
    var lean = state.targetLane - state.laneVisual;
    if (lean < -0.07 && playerSprites.left && playerSprites.left.naturalWidth) {
      return playerSprites.left;
    }
    if (lean > 0.07 && playerSprites.right && playerSprites.right.naturalWidth) {
      return playerSprites.right;
    }
    return playerSprites.center;
  }

  function drawPlayerSprite(px, py, cw, ch) {
    var img = pickPlayerImage();
    var drawH = (state.dismounted ? ch * 0.16 : ch * 0.13) * G;
    if (img && img.naturalWidth > 0) {
      var ar = img.naturalWidth / img.naturalHeight;
      var drawW = drawH * ar;
      var x0 = px - drawW * 0.5;
      var y0 = py - drawH * 0.92;
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, x0, y0, drawW, drawH);
      ctx.restore();
      return;
    }
    ctx.fillStyle = state.dismounted ? COLORS.scooterWalk : COLORS.scooter;
    if (state.dismounted) {
      ctx.fillRect(px - 12 * G, py - 40 * G, 24 * G, 40 * G);
    } else {
      ctx.fillRect(px - 22 * G, py - 18 * G, 44 * G, 22 * G);
      ctx.fillStyle = "#1e293b";
      ctx.beginPath();
      ctx.arc(px - 12 * G, py + 8 * G, 5 * G, 0, Math.PI * 2);
      ctx.arc(px + 12 * G, py + 8 * G, 5 * G, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#fef3c7";
    ctx.beginPath();
    ctx.arc(px, py - (state.dismounted ? 44 : 26) * G, 8 * G, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawEntities(w, h) {
    var px = laneCenterX(state.laneVisual, w);
    var py = worldY(0, h);

    state.entities.forEach(function (e) {
      if (e.type === "crossRoad") return;

      var x = laneCenterX(
        e.lane != null && e.lane >= 0 ? e.lane : 1,
        w
      );
      var relDraw = e.dist - state.dist;
      var y = worldY(relDraw, h);

      if (e.type === "charger") {
        var cw = laneWidthPx(w) * 0.65;
        var chh = 40 * G;
        var cy = 20 * G;
        var es = energySprite;
        if (es && es.naturalWidth > 0) {
          var eDrawH = 56 * G;
          var ear = es.naturalWidth / es.naturalHeight;
          var eDrawW = eDrawH * ear;
          var maxW = Math.min(56 * G, laneWidthPx(w) * 0.92);
          if (eDrawW > maxW) {
            eDrawW = maxW;
            eDrawH = eDrawW / ear;
          }
          ctx.save();
          ctx.globalAlpha = 0.22;
          ctx.fillStyle = COLORS.charge;
          ctx.fillRect(x - cw * 0.5, y - cy, cw, chh);
          ctx.restore();
          ctx.save();
          ctx.imageSmoothingEnabled = true;
          ctx.drawImage(
            es,
            x - eDrawW * 0.5,
            y - eDrawH * 0.82,
            eDrawW,
            eDrawH
          );
          ctx.restore();
        } else {
          ctx.fillStyle = COLORS.charge;
          ctx.fillRect(x - cw * 0.5, y - cy, cw, chh);
          ctx.strokeStyle = "#4ade80";
          ctx.strokeRect(x - cw * 0.5, y - cy, cw, chh);
        }
        ctx.fillStyle = "#fff";
        ctx.font = Math.round(10 * G) + "px Manrope, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("⚡ Зарядка", x, y + 4 * G);
      }

      if (e.type === "manhole") {
        var mh = manholeSprite;
        var msz = 46 * G;
        if (mh && mh.naturalWidth > 0) {
          ctx.save();
          ctx.imageSmoothingEnabled = true;
          ctx.drawImage(mh, x - msz * 0.5, y - msz * 0.5, msz, msz);
          ctx.restore();
        } else {
          ctx.fillStyle = COLORS.manhole;
          ctx.beginPath();
          ctx.arc(x, y, 20 * G, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = COLORS.manholeRing;
          ctx.lineWidth = 3 * G;
          ctx.stroke();
        }
      }

      if (e.type === "pedestrian") {
        var pxp = x + (e.offset || 0);
        var vi = Math.max(0, Math.min(3, (e.variant || 1) - 1));
        var pair = walkerSprites[vi];
        var fwd = (e.walkAlong || 1) > 0;
        var fr = fwd ? pair && pair.right : pair && pair.left;
        if (!fr || !fr.naturalWidth) {
          for (var wk = 0; wk < 4; wk++) {
            var p = walkerSprites[wk];
            if (!p) continue;
            var cand = fwd ? p.right : p.left;
            if (cand && cand.naturalWidth) {
              fr = cand;
              break;
            }
          }
        }
        var drawH = 46 * G;
        if (fr && fr.naturalWidth > 0) {
          var ar = fr.naturalWidth / fr.naturalHeight;
          var drawW = drawH * ar;
          ctx.save();
          ctx.imageSmoothingEnabled = true;
          ctx.drawImage(fr, pxp - drawW * 0.5, y - drawH * 0.92, drawW, drawH);
          ctx.restore();
        } else {
          var pw = 14 * G;
          var ph = 40 * G;
          ctx.fillStyle = COLORS.ped;
          ctx.fillRect(pxp - pw, y - ph, pw * 2, ph);
          ctx.fillStyle = "#3f3f46";
          ctx.beginPath();
          ctx.arc(pxp, y - 46 * G, 10 * G, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });

    drawPlayerSprite(px, py, w, h);

    if (state.strikeFlash > 0 || state.fineFlash > 0) {
      ctx.fillStyle =
        "rgba(248, 113, 113, " + (state.fineFlash * 0.35 + state.strikeFlash * 0.25) + ")";
      ctx.fillRect(0, 0, w, h);
    }
  }

  function drawImageCover(img, x, y, cw, ch) {
    var ir = img.naturalWidth / img.naturalHeight;
    var cr = cw / ch;
    var nw;
    var nh;
    var ox;
    var oy;
    if (ir > cr) {
      nh = ch;
      nw = nh * ir;
      ox = x + (cw - nw) / 2;
      oy = y;
    } else {
      nw = cw;
      nh = nw / ir;
      ox = x;
      oy = y + (ch - nh) / 2;
    }
    ctx.drawImage(img, ox, oy, nw, nh);
  }

  function render() {
    var w = canvas.width / devicePixelRatio;
    var h = canvas.height / devicePixelRatio;

    if (!state.running) {
      if (promoSprite && promoSprite.naturalWidth > 0) {
        ctx.fillStyle = "#0a0b12";
        ctx.fillRect(0, 0, w, h);
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        drawImageCover(promoSprite, 0, 0, w, h);
        ctx.restore();
      } else {
        drawRoad(w, h);
        drawCrossRoads(w, h);
        drawEntities(w, h);
      }
      return;
    }

    drawRoad(w, h);
    drawCrossRoads(w, h);
    drawEntities(w, h);

    if (inRedLightViolation()) {
      ctx.fillStyle = "rgba(248,113,113,0.15)";
      ctx.fillRect(0, 0, w, h * 0.25);
    }
  }

  function loop(ts) {
    if (!state.running) return;
    if (!state.lastTs) state.lastTs = ts;
    var dt = Math.min(0.05, (ts - state.lastTs) / 1000);
    state.lastTs = ts;
    if (!state.paused && !state.gameOver) update(dt);
    render();
    requestAnimationFrame(loop);
  }

  function startGame() {
    loadGameSprites();
    resize();
    root.classList.add("scooter-game--playing");
    laneGesture = null;
    state.running = true;
    state.paused = false;
    state.gameOver = false;
    state.t = 0;
    state.lastTs = 0;
    state.score = 0;
    state.fines = 0;
    state.battery = 100;
    state.throttle = 0;
    state.dismounted = false;
    state.playerLane = state.targetLane = state.laneVisual = 1;
    state.dist = 0;
    state.entities = [];
    for (var ip = 0; ip < 3; ip++) {
      state.entities.push({
        type: "pedestrian",
        lane: ip % LANES,
        dist: Math.round(95 * G + ip * 185 * G),
        walkAlong: ip % 2 === 0 ? 1 : -1,
        walkSpeed: 22 + (ip % 3) * 7,
        side: ip % 2 === 0 ? 1 : -1,
        offset: (ip - 1) * 10 * G,
        variant: 1 + (ip % 4),
      });
    }
    state.spawnTimer = 0.5;
    state.violationMeter = 0;
    if (overlay) {
      overlay.hidden = true;
      overlay.classList.remove("is-pause");
    }
    if (btnStart) btnStart.textContent = "Играть снова";
    if (btnPause) btnPause.textContent = "Пауза";
    if (hudFines) hudFines.textContent = "0";
    var touchUi = false;
    if (window.matchMedia) {
      touchUi =
        window.matchMedia("(max-width: 639px)").matches ||
        (window.matchMedia("(hover: none)").matches &&
          window.matchMedia("(pointer: coarse)").matches);
    }
    setMsg(
      touchUi
        ? "Вверху: свайп влево/вправо или тап по зонам — полоса. Низ — газ и тормоз."
        : "W — газ, S — тормоз; на месте с зажатым S можно чуть откатиться назад.",
      5
    );
    setTimeout(function () {
      if (canvas && canvas.focus) {
        try {
          canvas.focus({ preventScroll: true });
        } catch (e1) {
          canvas.focus();
        }
      }
    }, 0);
    requestAnimationFrame(loop);
  }

  function endGame(msg, overlayTitleText) {
    state.gameOver = true;
    state.running = false;
    root.classList.remove("scooter-game--playing");
    touchDrive.gas = false;
    touchDrive.brake = false;
    touchDrive.brakeBtn = false;
    laneGesture = null;
    if (overlay) {
      overlay.hidden = false;
      overlay.classList.remove("is-pause");
    }
    if (overlayTitle)
      overlayTitle.textContent = overlayTitleText || "Игра окончена";
    if (overlayText)
      overlayText.textContent =
        msg + " Очки: " + Math.floor(state.score) + ", штрафы: " + state.fines;
    if (btnPause) btnPause.textContent = "Пауза";
    render();
  }

  function togglePause() {
    if (state.gameOver || !state.running) return;
    state.paused = !state.paused;
    if (btnPause) btnPause.textContent = state.paused ? "Продолжить" : "Пауза";
    if (state.paused) {
      touchDrive.gas = false;
      touchDrive.brake = false;
      touchDrive.brakeBtn = false;
      laneGesture = null;
      if (overlay) {
        overlay.hidden = false;
        overlay.classList.add("is-pause");
      }
      if (overlayTitle) overlayTitle.textContent = "Пауза";
      setOverlayBody("Нажмите «Продолжить» под полем игры.");
    } else {
      if (overlay) {
        overlay.hidden = true;
        overlay.classList.remove("is-pause");
      }
      state.lastTs = 0;
      requestAnimationFrame(loop);
    }
  }

  var GAME_CODES = {
    KeyW: 1,
    KeyS: 1,
    KeyA: 1,
    KeyD: 1,
    KeyX: 1,
    ArrowLeft: 1,
    ArrowRight: 1,
    ArrowUp: 1,
    ArrowDown: 1,
  };

  window.addEventListener(
    "keydown",
    function (ev) {
      if (!GAME_CODES[ev.code]) return;
      if (state.running && !state.gameOver && !state.paused) {
        keysHeld[ev.code] = true;
        ev.preventDefault();
      }
      if (!state.running || state.gameOver || state.paused) return;
      if (ev.repeat) return;
      if (ev.code === "KeyA" || ev.code === "ArrowLeft") {
        state.targetLane = Math.max(0, state.targetLane - 1);
        ev.preventDefault();
      }
      if (ev.code === "KeyD" || ev.code === "ArrowRight") {
        state.targetLane = Math.min(LANES - 1, state.targetLane + 1);
        ev.preventDefault();
      }
      if (ev.code === "KeyX") {
        state.dismounted = !state.dismounted;
        ev.preventDefault();
      }
    },
    { passive: false }
  );
  window.addEventListener("keyup", function (ev) {
    if (GAME_CODES[ev.code]) keysHeld[ev.code] = false;
  });
  window.addEventListener("blur", function () {
    keysHeld = {};
    touchDrive.gas = false;
    touchDrive.brake = false;
    touchDrive.brakeBtn = false;
    laneGesture = null;
  });

  if (btnStart) btnStart.addEventListener("click", startGame);
  if (btnPause) btnPause.addEventListener("click", togglePause);

  function canvasSteer(clientX) {
    if (!state.running || state.gameOver || state.paused) return;
    var rect = canvas.getBoundingClientRect();
    var x = clientX - rect.left;
    if (x < rect.width * 0.33) state.targetLane = Math.max(0, state.targetLane - 1);
    else if (x > rect.width * 0.67) state.targetLane = Math.min(LANES - 1, state.targetLane + 1);
  }

  function syncTouchDrivingFromTouches(touches) {
    touchDrive.gas = false;
    touchDrive.brake = false;
    if (!state.running || state.paused || state.gameOver) return;
    var rect = canvas.getBoundingClientRect();
    var i;
    for (i = 0; i < touches.length; i++) {
      var t = touches[i];
      var x = t.clientX - rect.left;
      var y = t.clientY - rect.top;
      if (y < rect.height * 0.52 || y > rect.height + 8) continue;
      var xf = x / rect.width;
      if (xf < 0.2 || xf > 0.8) touchDrive.brake = true;
      else touchDrive.gas = true;
    }
    if (touchDrive.brake) touchDrive.gas = false;
  }

  function onCanvasTouchStart(ev) {
    if (!state.running || state.gameOver || state.paused) return;
    var rect = canvas.getBoundingClientRect();
    var k;
    for (k = 0; k < ev.changedTouches.length; k++) {
      var te = ev.changedTouches[k];
      var y = te.clientY - rect.top;
      if (y < rect.height * 0.52) {
        laneGesture = { x: te.clientX, y: te.clientY, id: te.identifier };
      }
    }
    syncTouchDrivingFromTouches(ev.touches);
    ev.preventDefault();
  }

  function onCanvasTouchMove(ev) {
    if (!state.running || state.gameOver || state.paused) return;
    syncTouchDrivingFromTouches(ev.touches);
    ev.preventDefault();
  }

  function onCanvasTouchEnd(ev) {
    if (state.running && !state.gameOver && !state.paused) {
      var k;
      for (k = 0; k < ev.changedTouches.length; k++) {
        var te = ev.changedTouches[k];
        if (laneGesture && te.identifier === laneGesture.id) {
          var dx = te.clientX - laneGesture.x;
          var dy = te.clientY - laneGesture.y;
          if (
            Math.abs(dx) >= LANE_SWIPE_MIN_PX &&
            Math.abs(dx) > Math.abs(dy) + 8
          ) {
            if (dx > 0) {
              state.targetLane = Math.min(LANES - 1, state.targetLane + 1);
            } else {
              state.targetLane = Math.max(0, state.targetLane - 1);
            }
          } else if (Math.abs(dx) < 34 && Math.abs(dy) < 44) {
            canvasSteer(te.clientX);
          }
          laneGesture = null;
        }
      }
    } else {
      laneGesture = null;
    }
    syncTouchDrivingFromTouches(ev.touches);
  }

  canvas.addEventListener("mousedown", function () {
    if (state.running && !state.gameOver) {
      try {
        canvas.focus({ preventScroll: true });
      } catch (e2) {
        canvas.focus();
      }
    }
  });
  canvas.addEventListener("click", function (ev) {
    canvasSteer(ev.clientX);
  });
  canvas.addEventListener("touchstart", onCanvasTouchStart, { passive: false });
  canvas.addEventListener("touchmove", onCanvasTouchMove, { passive: false });
  canvas.addEventListener("touchend", onCanvasTouchEnd, { passive: true });
  canvas.addEventListener("touchcancel", onCanvasTouchEnd, { passive: true });

  var touchBrakeBtn = document.getElementById("scooterTouchBrake");
  var touchDismountBtn = document.getElementById("scooterTouchDismount");
  if (touchBrakeBtn) {
    function brakeBtnOff() {
      touchDrive.brakeBtn = false;
    }
    touchBrakeBtn.addEventListener("pointerdown", function (e) {
      if (!state.running || state.gameOver || state.paused) return;
      e.preventDefault();
      touchDrive.brakeBtn = true;
      try {
        touchBrakeBtn.setPointerCapture(e.pointerId);
      } catch (eCap) {}
    });
    touchBrakeBtn.addEventListener("pointerup", brakeBtnOff);
    touchBrakeBtn.addEventListener("pointercancel", brakeBtnOff);
    touchBrakeBtn.addEventListener("lostpointercapture", brakeBtnOff);
  }
  if (touchDismountBtn) {
    touchDismountBtn.addEventListener("click", function () {
      if (!state.running || state.gameOver || state.paused) return;
      state.dismounted = !state.dismounted;
    });
  }

  window.addEventListener("resize", function () {
    resize();
    render();
  });

  resize();
  render();
})();
