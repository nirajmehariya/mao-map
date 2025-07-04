/*!
 * 毛泽东生平地理轨迹可视化 - 主脚本文件
 * Author: sansan0
 * GitHub: https://github.com/sansan0
 */

// ==================== 全局变量 ====================
let map = null;
let regionsData = null;
let trajectoryData = null;
let currentEventIndex = 0;
let previousEventIndex = 0;
let isPlaying = false;
let playInterval = null;
let eventMarkers = [];
let pathLayers = [];
let coordinateMap = new Map();
let locationGroups = new Map();
let locationMarkers = new Map();
let statsHoverTimeout = null;
let currentPlaySpeed = 1000;
let isPanelVisible = true;
let isFeedbackModalVisible = false;
let isCameraFollowEnabled = true;

let animationConfig = {
  pathDuration: 3000,
  timelineDuration: 500,
  isAnimating: false,
};

// ==================== 全局常量 ====================
/**
 * 国际坐标数据配置
 * 统一管理所有国际地点的坐标信息，避免重复定义
 */
const INTERNATIONAL_COORDINATES = {
  "俄罗斯 莫斯科": [37.6176, 55.7558],
};

// ==================== 设备检测 ====================
/**
 * 检测是否为移动设备
 */
function isMobileDevice() {
  return window.innerWidth <= 768;
}

// ==================== 移动端交互 ====================
/**
 * 切换控制面板显示/隐藏状态
 */
function toggleControlPanel() {
  const panel = document.getElementById("timeline-control");
  const toggleBtn = document.getElementById("toggle-panel-btn");
  const mapEl = document.getElementById("map");

  if (isPanelVisible) {
    panel.classList.add("hidden");
    toggleBtn.textContent = "⬆";
    mapEl.classList.remove("panel-visible");
    mapEl.classList.add("panel-hidden");
    isPanelVisible = false;
  } else {
    panel.classList.remove("hidden");
    toggleBtn.textContent = "⚙";
    mapEl.classList.remove("panel-hidden");
    mapEl.classList.add("panel-visible");
    isPanelVisible = true;
  }

  setTimeout(() => {
    if (map && map.invalidateSize) {
      map.invalidateSize({
        animate: true,
        pan: false,
      });
    }
  }, 350);
}

/**
 * 获取控制面板高度
 */
function getControlPanelHeight() {
  const panel = document.getElementById("timeline-control");
  if (!panel || panel.classList.contains("hidden")) {
    return 0;
  }

  const rect = panel.getBoundingClientRect();
  return rect.height;
}

/**
 * 精确调整移动端地图高度
 */
function adjustMapHeightPrecisely() {
  if (!isMobileDevice()) return;

  const mapEl = document.getElementById("map");
  if (!mapEl) return;

  const controlPanelHeight = getControlPanelHeight();
  const viewportHeight = window.innerHeight;

  if (isPanelVisible && controlPanelHeight > 0) {
    const mapHeight = viewportHeight - controlPanelHeight - 10;
    mapEl.style.height = `${Math.max(mapHeight, 200)}px`;
  } else {
    mapEl.style.height = `${viewportHeight}px`;
  }

  setTimeout(() => {
    if (map && map.invalidateSize) {
      map.invalidateSize({
        animate: true,
        pan: false,
      });
    }
  }, 100);
}

/**
 * 初始化移动端交互功能
 */
function initMobileInteractions() {
  const toggleBtn = document.getElementById("toggle-panel-btn");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", toggleControlPanel);
  }

  if (map && isMobileDevice()) {
    map.on("dblclick", (e) => {
      e.originalEvent.preventDefault();
      toggleControlPanel();
    });
  }

  initPanelDragClose();
}

/**
 * 初始化详细面板拖拽关闭功能（移动端）
 */
function initPanelDragClose() {
  if (!isMobileDevice()) return;

  const panel = document.getElementById("location-detail-panel");
  const panelHeader = panel?.querySelector(".panel-header");
  const backdrop = document.getElementById("panel-backdrop");

  if (!panel || !panelHeader) return;

  let touchState = {
    startY: 0,
    currentY: 0,
    deltaY: 0,
    startTime: 0,
    isDragging: false,
    hasMoved: false,
    isProcessing: false,
  };

  /**
   * 彻底重置所有拖拽状态
   */
  function resetAllStates(isClosing = false) {
    touchState = {
      startY: 0,
      currentY: 0,
      deltaY: 0,
      startTime: 0,
      isDragging: false,
      hasMoved: false,
      isProcessing: false,
    };

    panel.classList.remove("dragging");
    panelHeader.classList.remove("dragging");

    if (!isClosing) {
      panel.style.transform = "translateY(0)";
      panel.style.transition =
        "transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)";

      if (backdrop) {
        backdrop.style.opacity = "0.3";
        backdrop.style.transition = "opacity 0.3s ease";
      }

      if (!panel.classList.contains("visible")) {
        panel.classList.add("visible");
      }

      setTimeout(() => {
        if (panel.style.transition.includes("transform")) {
          panel.style.transition = "";
        }
        if (backdrop && backdrop.style.transition.includes("opacity")) {
          backdrop.style.transition = "";
        }
      }, 350);
    }
  }

  /**
   * 安全关闭面板
   */
  function safeClosePanel() {
    touchState.isProcessing = true;

    panel.style.transform = "translateY(100%)";
    panel.style.transition =
      "transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)";

    if (backdrop) {
      backdrop.style.opacity = "0";
      backdrop.style.transition = "opacity 0.3s ease";
    }

    setTimeout(() => {
      try {
        hideDetailPanel();
      } catch (error) {
        console.error("关闭面板时出错:", error);
      }

      setTimeout(() => {
        resetAllStates(true);
      }, 100);
    }, 300);
  }

  /**
   * 开始拖拽处理
   */
  function handleTouchStart(e) {
    if (touchState.isProcessing) {
      return;
    }

    if (
      e.target.closest(".panel-close") ||
      e.target.closest(".panel-content")
    ) {
      return;
    }

    const touch = e.touches[0];
    touchState.startY = touch.clientY;
    touchState.currentY = touch.clientY;
    touchState.startTime = Date.now();
    touchState.isDragging = true;
    touchState.hasMoved = false;
    touchState.deltaY = 0;

    panel.classList.add("dragging");
    panelHeader.classList.add("dragging");

    panel.style.transition = "none";
    if (backdrop) {
      backdrop.style.transition = "none";
    }

    e.preventDefault();
  }

  /**
   * 拖拽移动处理
   */
  function handleTouchMove(e) {
    if (!touchState.isDragging || touchState.isProcessing) {
      return;
    }

    const touch = e.touches[0];
    touchState.currentY = touch.clientY;
    touchState.deltaY = touchState.currentY - touchState.startY;

    if (!touchState.hasMoved && Math.abs(touchState.deltaY) > 3) {
      touchState.hasMoved = true;
    }

    if (touchState.deltaY > 0) {
      // 阻尼效果计算
      const maxDrag = 250;
      const dampingFactor = Math.max(
        0.3,
        1 - (touchState.deltaY / maxDrag) * 0.7
      );
      const transformValue = Math.min(
        touchState.deltaY * dampingFactor,
        maxDrag
      );

      panel.style.transform = `translateY(${transformValue}px)`;

      // 背景透明度变化
      if (backdrop) {
        const maxOpacity = 0.3;
        const opacityReduction = (touchState.deltaY / 200) * maxOpacity;
        const newOpacity = Math.max(0.05, maxOpacity - opacityReduction);
        backdrop.style.opacity = newOpacity.toString();
      }
    } else {
      panel.style.transform = "translateY(0)";
      if (backdrop) {
        backdrop.style.opacity = "0.3";
      }
    }

    e.preventDefault();
  }

  /**
   * 结束拖拽处理
   */
  function handleTouchEnd(e) {
    if (!touchState.isDragging) {
      return;
    }

    const duration = Date.now() - touchState.startTime;
    const velocity = duration > 0 ? Math.abs(touchState.deltaY) / duration : 0;

    panel.classList.remove("dragging");
    panelHeader.classList.remove("dragging");

    panel.style.transition =
      "transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
    if (backdrop) {
      backdrop.style.transition = "opacity 0.3s ease";
    }

    // 关闭判断条件
    const shouldClose =
      touchState.hasMoved &&
      (touchState.deltaY > 40 ||
        (touchState.deltaY > 20 && velocity > 0.2) ||
        (touchState.deltaY > 10 && velocity > 0.5));

    if (shouldClose) {
      safeClosePanel();
    } else {
      resetAllStates(false);
    }
  }

  /**
   * 取消拖拽处理
   */
  function handleTouchCancel(e) {
    if (touchState.isDragging && !touchState.isProcessing) {
      resetAllStates();
    }
  }

  /**
   * 清理事件监听器
   */
  function cleanupEventListeners() {
    panelHeader.removeEventListener("touchstart", handleTouchStart);
    panelHeader.removeEventListener("touchmove", handleTouchMove);
    panelHeader.removeEventListener("touchend", handleTouchEnd);
    panelHeader.removeEventListener("touchcancel", handleTouchCancel);
  }

  /**
   * 绑定事件监听器
   */
  function bindEventListeners() {
    panelHeader.addEventListener("touchstart", handleTouchStart, {
      passive: false,
    });

    panelHeader.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    });

    panelHeader.addEventListener("touchend", handleTouchEnd, {
      passive: false,
    });

    panelHeader.addEventListener("touchcancel", handleTouchCancel, {
      passive: false,
    });
  }

  // 初始化事件监听器
  cleanupEventListeners();
  bindEventListeners();

  // 防止面板内容区域干扰
  const panelContent = panel.querySelector(".panel-content");
  if (panelContent) {
    panelContent.addEventListener(
      "touchstart",
      (e) => {
        e.stopPropagation();
      },
      { passive: true }
    );

    panelContent.addEventListener(
      "touchmove",
      (e) => {
        e.stopPropagation();
      },
      { passive: true }
    );
  }

  // 确保关闭按钮正常工作
  const closeBtn = panel.querySelector(".panel-close");
  if (closeBtn) {
    closeBtn.addEventListener(
      "touchstart",
      (e) => {
        e.stopPropagation();
      },
      { passive: true }
    );

    closeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      hideDetailPanel();
    });
  }

  window.cleanupDragListeners = cleanupEventListeners;
}

// ==================== 地图初始化 ====================
/**
 * 初始化Leaflet地图
 */
function initMap() {
  map = L.map("map", {
    center: [35.8617, 104.1954],
    zoom: 5,
    minZoom: 4,
    maxZoom: 10,
    zoomControl: true,
    attributionControl: false,
    tap: true,
    tapTolerance: 15,
  });

  L.tileLayer(
    "https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}",
    {
      subdomains: "1234",
      attribution: "© 高德地图",
      maxZoom: 18,
    }
  ).addTo(map);

  console.log("地图初始化完成");
}

// ==================== 统计面板控制 ====================
/**
 * 初始化PC端统计面板悬停交互
 */
function initStatsHover() {
  const statsPanel = document.getElementById("stats-panel");
  const hoverArea = document.getElementById("stats-hover-area");

  if (!statsPanel || !hoverArea || isMobileDevice()) return;

  function showStatsPanel() {
    if (statsHoverTimeout) {
      clearTimeout(statsHoverTimeout);
      statsHoverTimeout = null;
    }
    statsPanel.classList.add("visible");
  }

  function hideStatsPanel() {
    statsHoverTimeout = setTimeout(() => {
      statsPanel.classList.remove("visible");
    }, 150);
  }

  hoverArea.addEventListener("mouseenter", showStatsPanel);
  hoverArea.addEventListener("mouseleave", hideStatsPanel);
  statsPanel.addEventListener("mouseenter", showStatsPanel);
  statsPanel.addEventListener("mouseleave", hideStatsPanel);
}

// ==================== 详细信息面板控制 ====================
/**
 * 初始化详细信息面板交互
 */
function initDetailPanel() {
  const panel = document.getElementById("location-detail-panel");
  const backdrop = document.getElementById("panel-backdrop");
  const closeBtn = document.getElementById("panel-close-btn");

  if (closeBtn) {
    closeBtn.addEventListener("click", hideDetailPanel);
  }

  if (backdrop) {
    backdrop.addEventListener("click", hideDetailPanel);
  }

  if (panel) {
    panel.addEventListener("click", (e) => {
      e.stopPropagation();
    });
  }

  if (!isMobileDevice()) {
    document.addEventListener("click", (e) => {
      if (panel && panel.classList.contains("visible")) {
        const isClickInsidePanel = panel.contains(e.target);
        const isClickOnMarker = e.target.closest(".leaflet-marker-icon");

        if (!isClickInsidePanel && !isClickOnMarker) {
          hideDetailPanel();
        }
      }
    });
  }
}

/**
 * 显示地点详细信息面板
 */
function showDetailPanel(locationGroup) {
  const panel = document.getElementById("location-detail-panel");
  const backdrop = document.getElementById("panel-backdrop");
  const titleEl = document.getElementById("panel-location-title");
  const summaryEl = document.getElementById("panel-visit-summary");
  const contentEl = document.getElementById("panel-content");

  if (!panel || !titleEl || !summaryEl || !contentEl) return;

  const { location, events } = locationGroup;
  const visitCount = events.length;
  const transitCount = events.filter((e) => e.visitType === "途径").length;
  const destCount = events.filter((e) => e.visitType === "目的地").length;
  const startCount = events.filter((e) => e.visitType === "起点").length;
  const activityCount = events.filter((e) => e.visitType === "活动").length;
  const birthCount = events.filter((e) => e.visitType === "出生").length;

  titleEl.textContent = `📍 ${location}`;

  let summaryText = `截止当前时间点共 <span class="visit-count-highlight">${visitCount}</span> 次相关记录`;

  let descParts = [];
  if (birthCount > 0) descParts.push(`${birthCount}次出生`);
  if (destCount > 0) descParts.push(`${destCount}次到达`);
  if (startCount > 0) descParts.push(`${startCount}次出发`);
  if (transitCount > 0) descParts.push(`${transitCount}次途径`);
  if (activityCount > 0) descParts.push(`${activityCount}次活动`);

  if (descParts.length > 0) {
    summaryText += ` (${descParts.join("，")})`;
  }

  summaryEl.innerHTML = summaryText;

  // 按时间顺序排序
  const sortedEvents = [...events].sort((a, b) => a.index - b.index);

  const eventListHtml = sortedEvents
    .map((event, index) => {
      const isCurrentEvent = event.index === currentEventIndex;
      const itemClass = isCurrentEvent
        ? "event-item current-event"
        : "event-item";

      let visitTypeClass = "";
      let visitTypeLabel = "";
      let visitOrderClass = "";

      // 左侧显示按时间顺序的次数
      const orderNumber = `第${index + 1}次`;

      // 右侧显示事件类型
      switch (event.visitType) {
        case "出生":
          visitTypeClass = "birth-event";
          visitTypeLabel = "出生";
          visitOrderClass = "birth-order";
          break;
        case "起点":
          visitTypeClass = "start-event";
          visitTypeLabel = "出发";
          visitOrderClass = "start-order";
          break;
        case "目的地":
          visitTypeLabel = "到达";
          visitOrderClass = "";
          break;
        case "途径":
          visitTypeClass = "transit-event";
          visitTypeLabel = "途径";
          visitOrderClass = "transit-order";
          break;
        case "活动":
          visitTypeClass = "activity-event";
          visitTypeLabel = "活动";
          visitOrderClass = "activity-order";
          break;
      }

      return `
      <div class="${itemClass} ${visitTypeClass}">
        <div class="event-header">
          <span class="visit-order-number">${orderNumber}</span>
          <span class="event-date-item">${event.date}</span>
          <span class="visit-order ${visitOrderClass}">${visitTypeLabel}</span>
        </div>
        <div class="event-description">${
          event.originalEvent || event.event
        }</div>
        ${event.age ? `<div class="event-age">年龄: ${event.age}岁</div>` : ""}
      </div>
    `;
    })
    .join("");

  contentEl.innerHTML = eventListHtml;

  if (backdrop && isMobileDevice()) {
    backdrop.classList.add("visible");
  }

  panel.classList.add("visible");

  if (isMobileDevice()) {
    setTimeout(() => {
      initPanelDragClose();
    }, 100);
  }
}

/**
 * 隐藏详细信息面板
 */
function hideDetailPanel() {
  const panel = document.getElementById("location-detail-panel");
  const backdrop = document.getElementById("panel-backdrop");

  if (panel) {
    panel.classList.remove("visible", "dragging");
    panel.style.transform = "";
    panel.style.transition = "";
  }

  if (backdrop) {
    backdrop.classList.remove("visible", "dragging");
    backdrop.style.opacity = "";
    backdrop.style.transition = "";
  }

  if (window.cleanupDragListeners) {
    try {
      window.cleanupDragListeners();
    } catch (error) {
      console.warn("清理拖拽监听器时出错:", error);
    }
  }
}

// ==================== 反馈功能控制 ====================
/**
 * 初始化反馈功能
 */
function initFeedbackModal() {
  const feedbackBtn = document.getElementById("feedback-btn");
  const feedbackModal = document.getElementById("feedback-modal");
  const feedbackBackdrop = document.getElementById("feedback-backdrop");
  const feedbackClose = document.getElementById("feedback-modal-close");

  if (feedbackBtn) {
    feedbackBtn.addEventListener("click", showFeedbackModal);
  }

  if (feedbackClose) {
    feedbackClose.addEventListener("click", hideFeedbackModal);
  }

  if (feedbackBackdrop) {
    feedbackBackdrop.addEventListener("click", hideFeedbackModal);
  }

  if (feedbackModal) {
    feedbackModal.addEventListener("click", (e) => {
      e.stopPropagation();
    });
  }

  const issuesItem = document.getElementById("feedback-issues");
  const projectItem = document.getElementById("feedback-project");
  const wechatItem = document.getElementById("feedback-wechat");

  if (issuesItem) {
    issuesItem.addEventListener("click", () => {
      openGitHubIssues();
      hideFeedbackModal();
    });
  }

  if (projectItem) {
    projectItem.addEventListener("click", () => {
      openGitHubProject();
      hideFeedbackModal();
    });
  }

  if (wechatItem) {
    wechatItem.addEventListener("click", () => {
      handleWeChatAction();
    });
  }

  // ESC键关闭弹窗
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isFeedbackModalVisible) {
      hideFeedbackModal();
    }
  });
}

/**
 * 显示反馈弹窗
 */
function showFeedbackModal() {
  const feedbackModal = document.getElementById("feedback-modal");
  const feedbackBackdrop = document.getElementById("feedback-backdrop");

  if (feedbackModal && feedbackBackdrop) {
    feedbackBackdrop.classList.add("visible");
    feedbackModal.classList.add("visible");
    isFeedbackModalVisible = true;

    // 防止页面滚动
    document.body.style.overflow = "hidden";
  }
}

/**
 * 隐藏反馈弹窗
 */
function hideFeedbackModal() {
  const feedbackModal = document.getElementById("feedback-modal");
  const feedbackBackdrop = document.getElementById("feedback-backdrop");

  if (feedbackModal && feedbackBackdrop) {
    feedbackBackdrop.classList.remove("visible");
    feedbackModal.classList.remove("visible");
    isFeedbackModalVisible = false;

    // 恢复页面滚动
    document.body.style.overflow = "";
  }
}

/**
 * 打开GitHub Issues页面
 */
function openGitHubIssues() {
  const issuesUrl = "https://github.com/sansan0/mao-map/issues";
  window.open(issuesUrl, "_blank", "noopener,noreferrer");
}

/**
 * 打开GitHub项目主页
 */
function openGitHubProject() {
  const projectUrl = "https://github.com/sansan0/mao-map";
  window.open(projectUrl, "_blank", "noopener,noreferrer");
}

/**
 * 处理微信公众号操作
 */
function handleWeChatAction() {
  const wechatName = "硅基茶水间";

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(wechatName)
      .then(() => {
        showTemporaryMessage(
          "公众号名称已复制到剪贴板：" + wechatName,
          "success"
        );
      })
      .catch(() => {
        showTemporaryMessage("请搜索微信公众号：" + wechatName, "info");
      });
  } else {
    // 兼容性方案
    try {
      const textArea = document.createElement("textarea");
      textArea.value = wechatName;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      document.body.appendChild(textArea);
      textArea.select();
      textArea.setSelectionRange(0, 99999);
      document.execCommand("copy");
      document.body.removeChild(textArea);
      showTemporaryMessage(
        "公众号名称已复制到剪贴板：" + wechatName,
        "success"
      );
    } catch (err) {
      showTemporaryMessage("请搜索微信公众号：" + wechatName, "info");
    }
  }

  hideFeedbackModal();
}

/**
 * 显示临时提示消息
 */
function showTemporaryMessage(message, type = "info") {
  const existingMessage = document.querySelector(".temp-message");
  if (existingMessage) {
    existingMessage.remove();
  }

  const messageDiv = document.createElement("div");
  messageDiv.className = "temp-message";
  messageDiv.textContent = message;

  const colors = {
    success: { bg: "rgba(39, 174, 96, 0.9)", border: "#27ae60" },
    info: { bg: "rgba(52, 152, 219, 0.9)", border: "#3498db" },
    warning: { bg: "rgba(243, 156, 18, 0.9)", border: "#f39c12" },
  };

  const color = colors[type] || colors.info;

  Object.assign(messageDiv.style, {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    background: color.bg,
    color: "white",
    padding: "12px 20px",
    borderRadius: "8px",
    border: `1px solid ${color.border}`,
    zIndex: "9999",
    fontSize: "14px",
    fontWeight: "500",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
    backdropFilter: "blur(10px)",
    maxWidth: "90vw",
    textAlign: "center",
    lineHeight: "1.4",
  });

  document.body.appendChild(messageDiv);

  // 3秒后自动移除
  setTimeout(() => {
    if (messageDiv.parentNode) {
      messageDiv.style.opacity = "0";
      messageDiv.style.transform = "translate(-50%, -50%) scale(0.9)";
      messageDiv.style.transition = "all 0.3s ease";

      setTimeout(() => {
        if (messageDiv.parentNode) {
          messageDiv.remove();
        }
      }, 300);
    }
  }, 3000);
}

// ==================== 坐标数据处理 ====================
/**
 * 从地区数据构建坐标映射表
 */
function buildCoordinateMapFromRegions() {
  console.log("建立坐标映射...");

  if (regionsData && regionsData.regions) {
    regionsData.regions.forEach((region) => {
      const extPath = region.ext_path;
      const coordinates = region.coordinates;

      if (
        extPath &&
        coordinates &&
        Array.isArray(coordinates) &&
        coordinates.length === 2
      ) {
        coordinateMap.set(extPath, coordinates);
      }
    });
  }

  Object.entries(INTERNATIONAL_COORDINATES).forEach(([name, coords]) => {
    coordinateMap.set(name, coords);
  });

  console.log("坐标映射建立完成，共", coordinateMap.size, "个地点");
  console.log("国际坐标:", Object.keys(INTERNATIONAL_COORDINATES));
}

// ==================== 数据加载 ====================
/**
 * 加载地理坐标数据
 */
async function loadGeographicData() {
  try {
    const response = await fetch("data/china_regions_coordinates.json");

    if (response.ok) {
      regionsData = await response.json();
      buildCoordinateMapFromRegions();
      console.log("china_regions_coordinates.json 加载成功");
    } else {
      throw new Error("china_regions_coordinates.json 加载失败");
    }

    return true;
  } catch (error) {
    console.warn("外部地理数据加载失败:", error.message);
    Object.entries(INTERNATIONAL_COORDINATES).forEach(([name, coords]) => {
      coordinateMap.set(name, coords);
    });
    console.log("已加载备用国际坐标数据");
    return true;
  }
}

/**
 * 加载轨迹事件数据
 */
async function loadTrajectoryData() {
  try {
    const response = await fetch("data/mao_trajectory_events.json");
    if (!response.ok) {
      throw new Error(
        `加载事件数据失败: ${response.status} - ${response.statusText}`
      );
    }

    const rawData = await response.json();

    if (
      !rawData.events ||
      !Array.isArray(rawData.events) ||
      rawData.events.length === 0
    ) {
      throw new Error("mao_trajectory_events.json 格式错误或事件数据为空");
    }

    return processTrajectoryData(rawData);
  } catch (error) {
    console.error("加载轨迹数据失败:", error);
    throw error;
  }
}

// ==================== 坐标匹配 ====================
/**
 * 构建完整的行政区划路径
 */
function buildFullLocationPath(locationInfo) {
  if (!locationInfo) return null;

  let parts = [];

  if (locationInfo.country && locationInfo.country !== "中国") {
    parts.push(locationInfo.country);
    if (locationInfo.city) {
      parts.push(locationInfo.city);
    }
  } else {
    if (locationInfo.province) {
      parts.push(locationInfo.province);
    }
    if (locationInfo.city) {
      parts.push(locationInfo.city);
    }
    if (locationInfo.district && locationInfo.district !== locationInfo.city) {
      parts.push(locationInfo.district);
    }
  }

  const fullPath = parts.length > 0 ? parts.join(" ") : null;

  return fullPath;
}

/**
 * 根据位置信息获取坐标
 */
function getCoordinates(locationInfo) {
  if (!locationInfo) return null;

  if (locationInfo.coordinates) {
    return locationInfo.coordinates;
  }

  const fullPath = buildFullLocationPath(locationInfo);
  if (fullPath && coordinateMap.has(fullPath)) {
    return coordinateMap.get(fullPath);
  }

  console.warn("无法匹配坐标:", locationInfo, "构建路径:", fullPath);
  return null;
}

/**
 * 获取坐标和格式化地点名称
 */
function getCoordinatesWithLocation(locationInfo) {
  if (!locationInfo) return { coordinates: null, location: "未知地点" };

  if (locationInfo.coordinates) {
    return {
      coordinates: locationInfo.coordinates,
      location: formatLocationName(locationInfo),
    };
  }

  const fullPath = buildFullLocationPath(locationInfo);
  const coordinates =
    fullPath && coordinateMap.has(fullPath)
      ? coordinateMap.get(fullPath)
      : null;

  return {
    coordinates: coordinates,
    location: formatLocationName(locationInfo),
  };
}

/**
 * 格式化地点名称显示
 */
function formatLocationName(locationInfo) {
  if (!locationInfo) return "未知地点";

  let parts = [];

  if (locationInfo.country && locationInfo.country !== "中国") {
    parts.push(locationInfo.country);
    if (locationInfo.city) parts.push(locationInfo.city);
  } else {
    if (locationInfo.province) parts.push(locationInfo.province);
    if (locationInfo.city && locationInfo.city !== locationInfo.province) {
      parts.push(locationInfo.city);
    }
    if (locationInfo.district && locationInfo.district !== locationInfo.city) {
      parts.push(locationInfo.district);
    }
  }

  return parts.length > 0 ? parts.join(" ") : "未知地点";
}

// ==================== 轨迹数据处理 ====================
/**
 * 处理原始轨迹数据，添加坐标信息
 */
function processTrajectoryData(data) {
  const processedEvents = data.events.map((event, index) => {
    const processed = {
      ...event,
      index: index,
      startCoords: null,
      endCoords: null,
      transitCoords: [],
      startLocation: null,
      endLocation: null,
    };

    if (event.coordinates && event.coordinates.start) {
      const startResult = getCoordinatesWithLocation(event.coordinates.start);
      processed.startCoords = startResult.coordinates;
      processed.startLocation = startResult.location;
    }

    if (event.coordinates && event.coordinates.end) {
      const endResult = getCoordinatesWithLocation(event.coordinates.end);
      processed.endCoords = endResult.coordinates;
      processed.endLocation = endResult.location;
    }

    if (event.coordinates && event.coordinates.transit) {
      processed.transitCoords = event.coordinates.transit
        .map((transit) => getCoordinates(transit))
        .filter((coords) => coords !== null);
    }

    if (!processed.endLocation && processed.startLocation) {
      processed.endLocation = processed.startLocation;
      processed.endCoords = processed.startCoords;
    }

    return processed;
  });

  return {
    ...data,
    events: processedEvents,
  };
}

// ==================== 位置聚合 ====================
/**
 * 按地理位置聚合事件
 * 统计每个地点的事件类型，包括出生、起点、终点、途径点、活动
 */
function groupEventsByLocation(events, maxIndex) {
  const groups = new Map();

  for (let i = 0; i <= maxIndex; i++) {
    const event = events[i];

    // 特殊处理出生事件
    if (event.movementType === "出生") {
      if (event.endCoords && event.endLocation) {
        const coordKey = `${event.endCoords[0]},${event.endCoords[1]}`;

        if (!groups.has(coordKey)) {
          groups.set(coordKey, {
            coordinates: event.endCoords,
            location: event.endLocation,
            events: [],
            types: new Set(),
          });
        }

        const group = groups.get(coordKey);
        group.events.push({
          ...event,
          index: i,
          date: event.date,
          event: event.event,
          age: event.age,
          visitType: "出生",
        });

        group.types.add(event.movementType);
      }
    }
    // 特殊处理原地活动
    else if (event.movementType === "原地活动") {
      // 原地活动只记录一次，使用end坐标
      if (event.endCoords && event.endLocation) {
        const coordKey = `${event.endCoords[0]},${event.endCoords[1]}`;

        if (!groups.has(coordKey)) {
          groups.set(coordKey, {
            coordinates: event.endCoords,
            location: event.endLocation,
            events: [],
            types: new Set(),
          });
        }

        const group = groups.get(coordKey);
        group.events.push({
          ...event,
          index: i,
          date: event.date,
          event: event.event,
          age: event.age,
          visitType: "活动",
        });

        group.types.add(event.movementType);
      }
    } else {
      // 处理其他类型事件的起点坐标
      if (event.startCoords && event.startLocation) {
        const coordKey = `${event.startCoords[0]},${event.startCoords[1]}`;

        if (!groups.has(coordKey)) {
          groups.set(coordKey, {
            coordinates: event.startCoords,
            location: event.startLocation,
            events: [],
            types: new Set(),
          });
        }

        const group = groups.get(coordKey);
        group.events.push({
          ...event,
          index: i,
          date: event.date,
          event: event.event,
          age: event.age,
          visitType: "起点",
        });

        group.types.add(event.movementType);
      }

      // 处理其他类型事件的目的地坐标
      if (event.endCoords && event.endLocation) {
        const coordKey = `${event.endCoords[0]},${event.endCoords[1]}`;

        if (!groups.has(coordKey)) {
          groups.set(coordKey, {
            coordinates: event.endCoords,
            location: event.endLocation,
            events: [],
            types: new Set(),
          });
        }

        const group = groups.get(coordKey);
        group.events.push({
          ...event,
          index: i,
          date: event.date,
          event: event.event,
          age: event.age,
          visitType: "目的地",
        });

        group.types.add(event.movementType);
      }

      // 处理途径坐标
      if (
        event.transitCoords &&
        event.transitCoords.length > 0 &&
        event.coordinates &&
        event.coordinates.transit
      ) {
        event.transitCoords.forEach((coords, transitIndex) => {
          if (coords && event.coordinates.transit[transitIndex]) {
            const transitInfo = event.coordinates.transit[transitIndex];
            const transitResult = getCoordinatesWithLocation(transitInfo);

            if (transitResult.coordinates && transitResult.location) {
              const coordKey = `${coords[0]},${coords[1]}`;

              if (!groups.has(coordKey)) {
                groups.set(coordKey, {
                  coordinates: coords,
                  location: transitResult.location,
                  events: [],
                  types: new Set(),
                });
              }

              const group = groups.get(coordKey);
              group.events.push({
                ...event,
                index: i,
                date: event.date,
                event: `途经：${event.event}`,
                age: event.age,
                visitType: "途径",
                originalEvent: event.event,
              });

              group.types.add(event.movementType);
            }
          }
        });
      }
    }
  }

  return groups;
}

/**
 * 根据访问次数获取标记样式类
 */
function getVisitCountClass(visitCount) {
  if (visitCount === 1) return "visits-1";
  if (visitCount === 2) return "visits-2";
  if (visitCount === 3) return "visits-3";
  return "visits-4-plus";
}

/**
 * 根据事件类型获取主要标记类型
 *
 * 类型说明：
 * - 以下5种为手动标注的movementType：出生、国际移动、长途移动、短途移动、原地活动
 * - 混合类型(marker-mixed)为程序自动判断：仅当一个地点包含多种"移动"类型时使用（不包括"原地活动"）
 *
 * 优先级策略：
 * 1. 出生事件 - 最高优先级（历史起点，唯一性）
 * 2. 国际移动 - 高优先级（跨国界移动，政治重要性）
 * 3. 长途移动 - 中高优先级（跨省级行政区移动）
 * 4. 短途移动 - 中优先级（省内移动，有地理位移）
 * 5. 原地活动 - 低优先级（无地理位置变化）
 * 6. 混合类型 - 自动判断（包含多种移动类型时显示）
 */
function getPrimaryMarkerType(types) {
  if (types.has("出生")) return "marker-birth";

  if (types.has("国际移动")) return "marker-international";

  if (types.has("长途移动")) return "marker-long-distance";

  if (types.has("短途移动")) return "marker-short-distance";

  const movementTypes = ["国际移动", "长途移动", "短途移动"].filter((type) =>
    types.has(type)
  );
  if (movementTypes.length > 1) return "marker-mixed";

  if (types.has("原地活动")) return "marker-activity";

  // 默认类型：其他未分类的移动事件
  return "marker-movement";
}

/**
 * 创建地点标记
 */
function createLocationMarker(
  locationGroup,
  isCurrent = false,
  isVisited = false
) {
  const { coordinates, location, events, types } = locationGroup;
  const [lng, lat] = coordinates;
  const visitCount = events.length;

  const markerClasses = [
    "location-marker",
    getPrimaryMarkerType(types),
    getVisitCountClass(visitCount),
  ];

  if (isCurrent) markerClasses.push("current");
  if (isVisited) markerClasses.push("visited");

  const markerContent = visitCount > 1 ? visitCount.toString() : "";

  const baseSize = isMobileDevice() ? 2 : 0;
  const iconSizes = {
    1: [14 + baseSize, 14 + baseSize],
    2: [18 + baseSize, 18 + baseSize],
    3: [22 + baseSize, 22 + baseSize],
    4: [26 + baseSize, 26 + baseSize],
  };

  const sizeKey = visitCount >= 4 ? 4 : visitCount;
  const iconSize = iconSizes[sizeKey];
  const iconAnchor = [iconSize[0] / 2, iconSize[1] / 2];

  const markerElement = L.divIcon({
    className: markerClasses.join(" "),
    html: markerContent,
    iconSize: iconSize,
    iconAnchor: iconAnchor,
  });

  const marker = L.marker([lat, lng], {
    icon: markerElement,
    interactive: true,
    keyboard: true,
    zIndexOffset: 1000, // 确保标记在顶层
  });

  const clickHandler = function (e) {
    e.originalEvent.stopPropagation();
    showDetailPanel(locationGroup);
  };

  marker._originalClickHandler = clickHandler;

  marker.on("click", clickHandler);

  marker.on("add", function () {
    setTimeout(() => {
      if (marker._icon) {
        marker._icon.style.zIndex = "1000";
        marker._icon.style.pointerEvents = "auto";
        marker._icon.style.cursor = "pointer";
      }
    }, 50);
  });

  let tooltipText;
  if (visitCount === 1) {
    const event = events[0];
    tooltipText = `${event.date} - ${event.visitType === "途径" ? "途经" : ""}${
      event.originalEvent || event.event
    }`;
  } else {
    const transitCount = events.filter((e) => e.visitType === "途径").length;
    const destCount = events.filter((e) => e.visitType === "目的地").length;

    let desc = [];
    if (destCount > 0) desc.push(`${destCount}次到达`);
    if (transitCount > 0) desc.push(`${transitCount}次途径`);

    tooltipText = `${location} (${desc.join("，")})`;
  }

  marker.bindTooltip(tooltipText, {
    direction: "top",
    offset: [0, -15],
    className: "simple-tooltip",
  });

  return marker;
}

// ==================== 地图标记和路径 ====================
/**
 * 创建动画路径 - 支持事件内部路径和事件间连接路径
 */
function createAnimatedPath(
  fromCoords,
  toCoords,
  transitCoords = [],
  isLatest = false,
  eventIndex = null,
  isConnectionPath = false
) {
  if (!fromCoords || !toCoords) return null;

  const pathCoords = [];
  pathCoords.push([fromCoords[1], fromCoords[0]]);

  // 只有在事件内部路径时才使用途径点
  if (!isConnectionPath && transitCoords && transitCoords.length > 0) {
    transitCoords.forEach((coords) => {
      pathCoords.push([coords[1], coords[0]]);
    });
  }

  pathCoords.push([toCoords[1], toCoords[0]]);

  const pathOptions = {
    color: isLatest ? "#c0392b" : "#85c1e9",
    weight: isConnectionPath ? 2 : 3, // 连接路径稍细一些
    opacity: isLatest ? 0.9 : isConnectionPath ? 0.4 : 0.6,
    smoothFactor: 1,
    dashArray: isConnectionPath ? "4, 8" : "8, 8", // 连接路径用不同样式
  };

  const path = L.polyline(pathCoords, pathOptions);
  path._isAnimated = true;
  path._isLatest = isLatest;
  path._needsAnimation = isLatest;
  path._eventIndex = eventIndex;
  path._isConnectionPath = isConnectionPath;

  if (isLatest) {
    path._initiallyHidden = true;
  }

  return path;
}

/**
 * 更新路径样式
 */
function updatePathStyle(path, isLatest) {
  if (!path) return;

  const color = isLatest ? "#c0392b" : "#85c1e9";
  const opacity = isLatest ? 0.9 : 0.6;

  path.setStyle({
    color: color,
    opacity: opacity,
    dashArray: "8, 8",
  });

  path._isLatest = isLatest;

  if (path._path) {
    path._path.style.stroke = color;
    path._path.style.strokeOpacity = opacity;
  }
}

/**
 * 静态更新路径（无动画）
 */
function updatePathsStatic(targetIndex) {
  pathLayers.forEach((path) => map.removeLayer(path));
  pathLayers = [];

  for (let i = 0; i <= targetIndex; i++) {
    const currentEvent = trajectoryData.events[i];

    // 只要有起点和终点坐标，且不是原地活动，就绘制路径
    if (
      currentEvent.startCoords &&
      currentEvent.endCoords &&
      currentEvent.movementType !== "原地活动"
    ) {
      // 调试输出
      console.log(`事件 ${i}: ${currentEvent.event}`);
      console.log(`起点坐标:`, currentEvent.startCoords);
      console.log(`终点坐标:`, currentEvent.endCoords);

      const isLatest = i === targetIndex;
      const eventPath = createAnimatedPath(
        currentEvent.startCoords,
        currentEvent.endCoords,
        currentEvent.transitCoords,
        isLatest,
        i,
        false
      );

      if (eventPath) {
        eventPath._needsAnimation = false;
        eventPath._initiallyHidden = false;
        eventPath.addTo(map);
        pathLayers.push(eventPath);
        console.log(`成功添加路径: 事件 ${i}`);
      } else {
        console.warn(`路径创建失败: 事件 ${i}`);
      }
    } else {
      console.log(`跳过事件 ${i}: ${currentEvent.event} (原地活动或缺少坐标)`);
      if (!currentEvent.startCoords) console.log(`  缺少起点坐标`);
      if (!currentEvent.endCoords) console.log(`  缺少终点坐标`);
    }
  }
}

/**
 * 动画更新路径
 */
function updatePathsAnimated(targetIndex, isReverse = false) {
  if (isReverse) {
    // 反向播放：移除目标索引之后的所有路径
    const pathsToRemove = pathLayers.filter(
      (path) => path._eventIndex > targetIndex
    );

    if (pathsToRemove.length > 0) {
      pathsToRemove.forEach((pathToRemove, index) => {
        setTimeout(() => {
          if (pathToRemove._map) {
            applyPathAnimation(pathToRemove, true);

            setTimeout(() => {
              if (pathToRemove._map) {
                map.removeLayer(pathToRemove);
              }
              const pathIndex = pathLayers.indexOf(pathToRemove);
              if (pathIndex > -1) {
                pathLayers.splice(pathIndex, 1);
              }
            }, animationConfig.pathDuration);
          }
        }, index * 100);
      });
    }
  } else {
    // 正向播放：添加新的路径
    const currentEvent = trajectoryData.events[targetIndex];

    pathLayers.forEach((path) => {
      if (path._isLatest) {
        updatePathStyle(path, false);
      }
    });

    // 只要有起点和终点坐标，且不是原地活动，就绘制路径
    if (
      currentEvent.startCoords &&
      currentEvent.endCoords &&
      currentEvent.movementType !== "原地活动"
    ) {
      console.log(`动画添加路径: 事件 ${targetIndex} - ${currentEvent.event}`);

      const eventPath = createAnimatedPath(
        currentEvent.startCoords,
        currentEvent.endCoords,
        currentEvent.transitCoords,
        true,
        targetIndex,
        false
      );

      if (eventPath) {
        eventPath.addTo(map);
        pathLayers.push(eventPath);
        applyPathAnimation(eventPath, false);
      }
    }
  }
}

/**
 * 应用路径动画效果
 */
function applyPathAnimation(path, isReverse = false) {
  if (!path || !path._map) return;

  const pathElement = path.getElement
    ? path.getElement()
    : path._path ||
      path._renderer._container.querySelector(
        `[stroke="${path.options.color}"]`
      ) ||
      path._renderer._container.querySelector("path:last-child");

  if (pathElement) {
    const pathLength = pathElement.getTotalLength();
    pathElement.style.strokeDasharray = `${pathLength}`;
    pathElement.style.strokeDashoffset = isReverse ? "0" : `${pathLength}`;
    pathElement.style.transition = "none";

    requestAnimationFrame(() => {
      applyAnimationToElement(pathElement, isReverse);
    });
  } else {
    setTimeout(() => {
      const allPaths = path._renderer._container.querySelectorAll("path");
      const targetPath = allPaths[allPaths.length - 1];
      if (targetPath) {
        const pathLength = targetPath.getTotalLength();
        targetPath.style.strokeDasharray = `${pathLength}`;
        targetPath.style.strokeDashoffset = isReverse ? "0" : `${pathLength}`;
        targetPath.style.transition = "none";

        requestAnimationFrame(() => {
          applyAnimationToElement(targetPath, isReverse);
        });
      }
    }, 50);
  }
}

/**
 * 应用动画到路径元素
 */
function applyAnimationToElement(pathElement, isReverse = false) {
  try {
    const pathLength = pathElement.getTotalLength();
    const duration = animationConfig.pathDuration;

    pathElement.style.strokeDasharray = `${pathLength}`;
    pathElement.style.strokeDashoffset = isReverse ? "0" : `${pathLength}`;
    pathElement.style.transition = "none";

    pathElement.getBoundingClientRect();

    pathElement.style.transition = `stroke-dashoffset ${duration}ms ease-in-out`;

    requestAnimationFrame(() => {
      if (isReverse) {
        pathElement.style.strokeDashoffset = `${pathLength}`;
      } else {
        pathElement.style.strokeDashoffset = "0";
      }
    });

    setTimeout(() => {
      pathElement.style.strokeDasharray = "8, 8";
      pathElement.style.strokeDashoffset = "0";
      pathElement.style.transition = "none";
    }, duration + 100);
  } catch (error) {
    console.error("路径动画执行出错:", error);
    pathElement.style.strokeDasharray = "8, 8";
    pathElement.style.strokeDashoffset = "0";
  }
}

/**
 * 更新事件标记
 */
function updateEventMarkers(targetIndex) {
  eventMarkers.forEach((marker) => map.removeLayer(marker));
  eventMarkers = [];
  locationMarkers.clear();

  locationGroups = groupEventsByLocation(trajectoryData.events, targetIndex);

  const currentEvent = trajectoryData.events[targetIndex];
  const currentCoordKey = currentEvent.endCoords
    ? `${currentEvent.endCoords[0]},${currentEvent.endCoords[1]}`
    : null;

  locationGroups.forEach((locationGroup, coordKey) => {
    const isCurrent = coordKey === currentCoordKey;
    const isVisited = !isCurrent;

    const marker = createLocationMarker(locationGroup, isCurrent, isVisited);

    if (marker) {
      marker.addTo(map);
      eventMarkers.push(marker);
      locationMarkers.set(coordKey, marker);
    }
  });

  // 确保标记交互状态正确初始化
  setTimeout(() => {
    ensureMarkersInteractivity();
  }, 100);
}

/**
 * 确保标记交互性正常工作
 */
function ensureMarkersInteractivity() {
  eventMarkers.forEach((marker) => {
    if (marker._icon) {
      const zIndex = Math.abs(parseInt(marker._icon.style.zIndex) || 0) || 1000;
      marker._icon.style.zIndex = zIndex;

      marker._icon.style.pointerEvents = "auto";
      marker._icon.style.cursor = "pointer";

      if (!marker._hasInteractivityEnsured) {
        marker._hasInteractivityEnsured = true;

        const originalOnClick = marker._originalClickHandler;
        if (originalOnClick) {
          marker.off("click");
          marker.on("click", originalOnClick);
        }
      }
    }
  });

  // 强制刷新地图交互状态
  if (map && map.invalidateSize) {
    map.invalidateSize({
      animate: false,
      pan: false,
    });
  }
}

// ==================== 动画控制 ====================
/**
 * 显示指定索引的事件
 */
function showEventAtIndex(index, animated = true, isUserDrag = false) {
  if (!trajectoryData || index >= trajectoryData.events.length || index < 0)
    return;
  if (animationConfig.isAnimating && !isUserDrag) return;

  const isMovingForward = index > currentEventIndex;
  const isMovingBackward = index < currentEventIndex;

  previousEventIndex = currentEventIndex;
  currentEventIndex = index;
  const event = trajectoryData.events[index];

  if (animated && (isMovingForward || isMovingBackward)) {
    animationConfig.isAnimating = true;
    setTimeout(() => {
      animationConfig.isAnimating = false;
    }, animationConfig.pathDuration + 100);
  }

  updateCurrentEventInfo(event);
  updateProgress();
  updateEventMarkers(index);

  if (animated && (isMovingForward || isMovingBackward)) {
    updatePathsAnimated(index, isMovingBackward);
  } else {
    updatePathsStatic(index);
  }

  // 镜头跟随逻辑
  if (isCameraFollowEnabled) {
    handleCameraFollow(event, previousEventIndex, animated);
  }

  if (animated) {
    setTimeout(() => {
      ensureMarkersInteractivity();
    }, animationConfig.timelineDuration + 100);
  }
}

// ==================== 镜头跟随控制 ====================
/**
 * 处理镜头跟随逻辑
 */
function handleCameraFollow(currentEvent, previousIndex, animated = true) {
  if (!currentEvent) return;

  const bounds = calculatePathBounds(currentEvent, previousIndex);
  if (bounds && bounds.isValid()) {
    const panOptions = {
      animate: animated,
      duration: animated ? animationConfig.pathDuration / 1000 : 0,
      paddingTopLeft: [50, 50],
      paddingBottomRight: [50, 100], // 为底部控制面板留出空间
      maxZoom: 8, // 限制最大缩放级别，避免过度放大
    };

    map.fitBounds(bounds, panOptions);
  } else if (currentEvent.endCoords) {
    // 备用方案：直接定位到终点
    const [lng, lat] = currentEvent.endCoords;
    const panOptions = {
      animate: animated,
      duration: animated ? animationConfig.timelineDuration / 1000 : 0,
    };
    map.setView([lat, lng], Math.max(map.getZoom(), 6), panOptions);
  }
}

/**
 * 计算路径边界框
 */
function calculatePathBounds(currentEvent, previousIndex) {
  const coordinates = [];

  // 添加上一个事件的终点作为当前路径的起点上下文
  if (previousIndex >= 0 && trajectoryData.events[previousIndex]) {
    const prevEvent = trajectoryData.events[previousIndex];
    if (prevEvent.endCoords) {
      coordinates.push([prevEvent.endCoords[1], prevEvent.endCoords[0]]);
    }
  }

  // 添加当前事件的起点
  if (currentEvent.startCoords) {
    coordinates.push([
      currentEvent.startCoords[1],
      currentEvent.startCoords[0],
    ]);
  }

  // 添加所有途径点
  if (currentEvent.transitCoords && currentEvent.transitCoords.length > 0) {
    currentEvent.transitCoords.forEach((coords) => {
      if (coords && coords.length === 2) {
        coordinates.push([coords[1], coords[0]]);
      }
    });
  }

  // 添加当前事件的终点
  if (currentEvent.endCoords) {
    coordinates.push([currentEvent.endCoords[1], currentEvent.endCoords[0]]);
  }

  // 如果只有一个坐标点，扩展边界框
  if (coordinates.length === 1) {
    const [lat, lng] = coordinates[0];
    const offset = 0.1; // 经纬度偏移量
    coordinates.push([lat + offset, lng + offset]);
    coordinates.push([lat - offset, lng - offset]);
  }

  if (coordinates.length >= 2) {
    try {
      return L.latLngBounds(coordinates);
    } catch (error) {
      console.warn("计算边界框失败:", error);
      return null;
    }
  }

  return null;
}

/**
 * 切换镜头跟随状态
 */
function toggleCameraFollow() {
  isCameraFollowEnabled = !isCameraFollowEnabled;
  updateCameraFollowUI();

  // 保存设置到本地存储
  try {
    localStorage.setItem(
      "cameraFollowEnabled",
      isCameraFollowEnabled.toString()
    );
  } catch (error) {
    console.warn("无法保存镜头跟随设置:", error);
  }
}

/**
 * 更新镜头跟随UI状态
 */
function updateCameraFollowUI() {
  const cameraSwitch = document.getElementById("camera-follow-switch");
  const cameraStatus = document.getElementById("camera-follow-status");

  if (cameraSwitch) {
    if (isCameraFollowEnabled) {
      cameraSwitch.classList.add("active");
    } else {
      cameraSwitch.classList.remove("active");
    }
  }

  if (cameraStatus) {
    cameraStatus.textContent = isCameraFollowEnabled ? "开启" : "关闭";
  }
}

/**
 * 初始化镜头跟随控制
 */
function initCameraFollowControl() {
  // 从本地存储恢复设置
  try {
    const saved = localStorage.getItem("cameraFollowEnabled");
    if (saved !== null) {
      isCameraFollowEnabled = saved === "true";
    }
  } catch (error) {
    console.warn("无法读取镜头跟随设置:", error);
  }

  const cameraSwitch = document.getElementById("camera-follow-switch");
  if (cameraSwitch) {
    cameraSwitch.addEventListener("click", toggleCameraFollow);
  }

  // 初始化UI状态
  updateCameraFollowUI();
}

// ==================== UI更新 ====================
/**
 * 更新当前事件信息显示
 */
function updateCurrentEventInfo(event) {
  const pcElements = {
    "event-date": event.date,
    "event-title": event.event,
    "event-location": event.endLocation,
    "current-age": event.age,
  };

  Object.entries(pcElements).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  });

  const mobileElements = {
    "event-date-mobile": event.date,
    "event-title-mobile": event.event,
    "event-location-mobile": event.endLocation,
    "current-age-mobile": event.age,
  };

  Object.entries(mobileElements).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  });
}

/**
 * 更新进度信息
 */
function updateProgress() {
  const progress = trajectoryData
    ? ((currentEventIndex + 1) / trajectoryData.events.length) * 100
    : 0;

  const mobileElements = {
    "current-progress-mobile": progress.toFixed(1) + "%",
    "current-event-index-mobile": currentEventIndex + 1,
  };

  Object.entries(mobileElements).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  });

  const desktopElements = {
    "current-progress-desktop": progress.toFixed(1) + "%",
    "current-event-index-desktop": currentEventIndex + 1,
    "current-age-desktop": trajectoryData.events[currentEventIndex].age,
  };

  Object.entries(desktopElements).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  });

  const slider = document.getElementById("timeline-slider");
  if (slider && !slider.matches(":active")) {
    slider.value = currentEventIndex;
  }
}

/**
 * 更新统计数据
 */
function updateStatistics() {
  if (!trajectoryData || !trajectoryData.events) return;

  const events = trajectoryData.events;
  const movementEvents = events.filter(
    (e) => e.movementType !== "出生" && e.movementType !== "原地活动"
  );
  const internationalEvents = events.filter(
    (e) => e.movementType === "国际移动"
  );

  const visitedPlaces = new Set();
  events.forEach((event) => {
    if (event.endLocation) {
      let location = event.endLocation;
      if (location.includes("省")) {
        location = location.split("省")[0] + "省";
      } else if (location.includes("市")) {
        location = location.split("市")[0] + "市";
      }
      visitedPlaces.add(location);
    }
  });

  const startYear = parseInt(events[0].date.split("-")[0]);
  const endYear = parseInt(events[events.length - 1].date.split("-")[0]);
  const timeSpan = endYear - startYear;

  const pcStats = {
    "total-events": events.length,
    "movement-count": movementEvents.length,
    "visited-places": visitedPlaces.size,
    "international-count": internationalEvents.length,
    "time-span": timeSpan + "年",
  };

  Object.entries(pcStats).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  });
}

// ==================== 播放控制 ====================
/**
 * 切换播放/暂停状态
 */
function togglePlay() {
  const btn = document.getElementById("play-btn");
  if (!btn) return;

  if (isPlaying) {
    isPlaying = false;
    clearInterval(playInterval);
    btn.textContent = "▶";
    btn.title = "播放";
  } else {
    isPlaying = true;
    btn.textContent = "⏸";
    btn.title = "暂停";

    playInterval = setInterval(() => {
      if (currentEventIndex < trajectoryData.events.length - 1) {
        showEventAtIndex(currentEventIndex + 1, true);
      } else {
        togglePlay();
      }
    }, currentPlaySpeed);
  }
}

/**
 * 下一个事件
 */
function nextEvent() {
  if (currentEventIndex < trajectoryData.events.length - 1) {
    showEventAtIndex(currentEventIndex + 1, true, true);
  }
}

/**
 * 上一个事件
 */
function previousEvent() {
  if (currentEventIndex > 0) {
    showEventAtIndex(currentEventIndex - 1, true, true);
  }
}

// ==================== 键盘控制 ====================
/**
 * 统一的键盘事件处理函数
 */
function handleTimelineKeydown(e) {
  if (!trajectoryData || !trajectoryData.events) return;

  let newIndex = currentEventIndex;
  let handled = false;

  switch (e.key) {
    case "ArrowLeft":
    case "ArrowDown":
      newIndex = Math.max(0, currentEventIndex - 1);
      handled = true;
      break;
    case "ArrowRight":
    case "ArrowUp":
      newIndex = Math.min(
        trajectoryData.events.length - 1,
        currentEventIndex + 1
      );
      handled = true;
      break;
    case "Home":
      newIndex = 0;
      handled = true;
      break;
    case "End":
      newIndex = trajectoryData.events.length - 1;
      handled = true;
      break;
    case " ":
      e.preventDefault();
      togglePlay();
      return;
  }

  if (handled) {
    e.preventDefault();
    if (newIndex !== currentEventIndex) {
      showEventAtIndex(newIndex, true, true);
    }
  }
}

// ==================== 动画设置控制 ====================
/**
 * 初始化动画控制滑块
 */
function initAnimationControls() {
  const pathDurationSlider = document.getElementById("path-duration");
  const pathDurationDisplay = document.getElementById("path-duration-display");
  const timelineDurationSlider = document.getElementById("timeline-duration");
  const timelineDurationDisplay = document.getElementById(
    "timeline-duration-display"
  );

  if (pathDurationSlider && pathDurationDisplay) {
    pathDurationSlider.min = "500";
    pathDurationSlider.max = "8000";
    pathDurationSlider.value = "2000";
    pathDurationSlider.step = "200";

    pathDurationSlider.addEventListener("input", (e) => {
      animationConfig.pathDuration = parseInt(e.target.value);
      pathDurationDisplay.textContent =
        (animationConfig.pathDuration / 1000).toFixed(1) + "s";
    });

    pathDurationDisplay.textContent =
      (animationConfig.pathDuration / 1000).toFixed(1) + "s";
  }

  if (timelineDurationSlider && timelineDurationDisplay) {
    timelineDurationSlider.addEventListener("input", (e) => {
      animationConfig.timelineDuration = parseInt(e.target.value);
      timelineDurationDisplay.textContent =
        (animationConfig.timelineDuration / 1000).toFixed(1) + "s";

      const slider = document.getElementById("timeline-slider");
      if (slider) {
        slider.style.transition = `all ${animationConfig.timelineDuration}ms ease`;
      }
    });

    timelineDurationDisplay.textContent =
      (animationConfig.timelineDuration / 1000).toFixed(1) + "s";
  }
}

/**
 * 复制当前事件数据到剪贴板
 */
function copyCurrentEventData() {
  if (!trajectoryData || !trajectoryData.events || currentEventIndex < 0) {
    showTemporaryMessage("当前没有可复制的事件数据", "warning");
    return;
  }

  try {
    const currentEvent = trajectoryData.events[currentEventIndex];

    const cleanEventData = {
      date: currentEvent.date,
      age: currentEvent.age,
      movementType: currentEvent.movementType,
      event: currentEvent.event,
      coordinates: currentEvent.coordinates,
      verification: currentEvent.verification || "",
      userVerification: currentEvent.userVerification || [],
    };

    if (cleanEventData.userVerification.length === 0) {
      cleanEventData.userVerification = [
        {
          username: "考据者署名 (可选)",
          comment: "考据补充或感言 (可选)",
          date: "考据日期 (可选)",
        },
      ];
    }

    const jsonString = JSON.stringify(cleanEventData, null, 2);

    const formattedJson = `    ${jsonString.replace(/\n/g, "\n    ")},`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(formattedJson)
        .then(() => {
          const eventNumber = currentEventIndex + 1;
          showTemporaryMessage(
            `事件 ${eventNumber} 数据已复制到剪贴板`,
            "success"
          );
        })
        .catch(() => {
          // 降级到传统复制方法
          fallbackCopyToClipboard(formattedJson);
        });
    } else {
      // 兼容性方案
      fallbackCopyToClipboard(formattedJson);
    }
  } catch (error) {
    console.error("复制事件数据时出错:", error);
    showTemporaryMessage("复制失败，请重试", "warning");
  }
}

/**
 * 兼容性剪贴板复制方案
 */
function fallbackCopyToClipboard(text) {
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.top = "-9999px";
    document.body.appendChild(textArea);
    textArea.select();
    textArea.setSelectionRange(0, 99999);
    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);

    if (successful) {
      const eventNumber = currentEventIndex + 1;
      showTemporaryMessage(`事件 ${eventNumber} 数据已复制到剪贴板`, "success");
    } else {
      showTemporaryMessage("复制失败，请手动选择并复制", "warning");
    }
  } catch (err) {
    console.error("传统复制方法也失败:", err);
    showTemporaryMessage("复制失败，浏览器不支持自动复制", "warning");
  }
}

// ==================== 事件绑定 ====================
/**
 * 绑定所有事件监听器
 */
function bindEvents() {
  const playBtn = document.getElementById("play-btn");
  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");

  if (playBtn) playBtn.addEventListener("click", togglePlay);
  if (prevBtn) prevBtn.addEventListener("click", previousEvent);
  if (nextBtn) nextBtn.addEventListener("click", nextEvent);

  const slider = document.getElementById("timeline-slider");
  if (slider) {
    let isDragging = false;

    slider.addEventListener("mousedown", () => {
      isDragging = true;
    });

    slider.addEventListener("touchstart", () => {
      isDragging = true;
    });

    slider.addEventListener("mouseup", () => {
      if (isDragging) {
        isDragging = false;
        const finalIndex = parseInt(slider.value);
        if (finalIndex !== currentEventIndex) {
          showEventAtIndex(finalIndex, true, true);
        }
      }
    });

    slider.addEventListener("touchend", () => {
      if (isDragging) {
        isDragging = false;
        const finalIndex = parseInt(slider.value);
        if (finalIndex !== currentEventIndex) {
          showEventAtIndex(finalIndex, true, true);
        }
      }
    });

    slider.addEventListener("input", (e) => {
      if (trajectoryData) {
        const newIndex = parseInt(e.target.value);

        if (isDragging) {
          showEventAtIndex(newIndex, false, true);
        } else {
          showEventAtIndex(newIndex, true, true);
        }
      }
    });

    slider.addEventListener("dblclick", (e) => {
      e.preventDefault();
      copyCurrentEventData();
    });

    slider.addEventListener("keydown", (e) => {
      handleTimelineKeydown(e);
    });

    slider.addEventListener("focus", () => {
      slider.style.outline = "none";
    });

    slider.addEventListener("click", () => {
      slider.focus();
    });
  }

  document.addEventListener("keydown", (e) => {
    const activeElement = document.activeElement;
    const isInputElement =
      activeElement &&
      (activeElement.tagName === "INPUT" ||
        activeElement.tagName === "TEXTAREA" ||
        activeElement.tagName === "SELECT" ||
        activeElement.contentEditable === "true");

    const detailPanel = document.getElementById("location-detail-panel");
    const isPanelVisible =
      detailPanel && detailPanel.classList.contains("visible");

    if (!isInputElement && !isPanelVisible) {
      handleTimelineKeydown(e);
    }
  });

  const speedSelect = document.getElementById("speed-select");
  if (speedSelect) {
    speedSelect.addEventListener("change", (e) => {
      currentPlaySpeed = parseInt(e.target.value);
      if (isPlaying) {
        togglePlay();
        setTimeout(() => togglePlay(), 100);
      }
    });
  }
  initCustomSpeedSelect();

  const speedBtns = document.querySelectorAll(".speed-btn");
  speedBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      speedBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentPlaySpeed = parseInt(btn.dataset.speed);

      if (isPlaying) {
        togglePlay();
        setTimeout(() => togglePlay(), 100);
      }
    });
  });

  initAnimationControls();
  initStatsHover();
  initDetailPanel();
  initMobileInteractions();
  initFeedbackModal();
  initCameraFollowControl();

  window.addEventListener("resize", () => {
    const mapEl = document.getElementById("map");
    if (isMobileDevice()) {
      if (isPanelVisible) {
        mapEl.classList.remove("panel-hidden");
        mapEl.classList.add("panel-visible");
      } else {
        mapEl.classList.remove("panel-visible");
        mapEl.classList.add("panel-hidden");
      }
    } else {
      mapEl.classList.remove("panel-hidden", "panel-visible");
      isPanelVisible = true;
      document.getElementById("timeline-control").classList.remove("hidden");
    }
  });
}

/**
 * 隐藏加载提示
 */
function hideLoading() {
  const loading = document.getElementById("loading");
  if (loading) {
    loading.style.display = "none";
  }
}

// ==================== 自定义下拉选择器 ====================
/**
 * 初始化自定义速度选择器
 */
function initCustomSpeedSelect() {
  const customSelect = document.getElementById("custom-speed-select");
  if (!customSelect) return;

  const selectDisplay = customSelect.querySelector(".select-display");
  const selectText = customSelect.querySelector(".select-text");
  const selectDropdown = customSelect.querySelector(".select-dropdown");
  const selectOptions = customSelect.querySelectorAll(".select-option");

  let isOpen = false;

  /**
   * 打开下拉菜单
   */
  function openDropdown() {
    if (isOpen) return;

    isOpen = true;
    customSelect.classList.add("open");

    setTimeout(() => {
      document.addEventListener("click", handleDocumentClick);
    }, 0);
  }

  /**
   * 关闭下拉菜单
   */
  function closeDropdown() {
    if (!isOpen) return;

    isOpen = false;
    customSelect.classList.remove("open");
    document.removeEventListener("click", handleDocumentClick);
  }

  /**
   * 处理文档点击事件（用于关闭下拉菜单）
   */
  function handleDocumentClick(e) {
    if (!customSelect.contains(e.target)) {
      closeDropdown();
    }
  }

  /**
   * 切换下拉菜单状态
   */
  function toggleDropdown(e) {
    e.stopPropagation();
    if (isOpen) {
      closeDropdown();
    } else {
      openDropdown();
    }
  }

  /**
   * 选择选项
   */
  function selectOption(option) {
    const value = option.dataset.value;
    const text = option.textContent;

    selectText.textContent = text;

    customSelect.dataset.value = value;

    selectOptions.forEach((opt) => opt.classList.remove("selected"));
    option.classList.add("selected");

    currentPlaySpeed = parseInt(value);

    if (isPlaying) {
      togglePlay();
      setTimeout(() => togglePlay(), 100);
    }

    closeDropdown();
  }

  // 绑定点击事件到显示区域
  if (selectDisplay) {
    selectDisplay.addEventListener("click", toggleDropdown);
  }

  // 绑定点击事件到选项
  selectOptions.forEach((option) => {
    option.addEventListener("click", (e) => {
      e.stopPropagation();
      selectOption(option);
    });
  });

  // 键盘支持
  customSelect.addEventListener("keydown", (e) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        openDropdown();
      }
    } else {
      switch (e.key) {
        case "Escape":
          e.preventDefault();
          closeDropdown();
          break;
        case "ArrowUp":
          e.preventDefault();
          navigateOptions(-1);
          break;
        case "ArrowDown":
          e.preventDefault();
          navigateOptions(1);
          break;
        case "Enter":
          e.preventDefault();
          const selectedOption = selectDropdown.querySelector(
            ".select-option.selected"
          );
          if (selectedOption) {
            selectOption(selectedOption);
          }
          break;
      }
    }
  });

  /**
   * 键盘导航选项
   */
  function navigateOptions(direction) {
    const options = Array.from(selectOptions);
    const currentIndex = options.findIndex((opt) =>
      opt.classList.contains("selected")
    );
    let newIndex = currentIndex + direction;

    if (newIndex < 0) newIndex = options.length - 1;
    if (newIndex >= options.length) newIndex = 0;

    options.forEach((opt) => opt.classList.remove("selected"));
    options[newIndex].classList.add("selected");
  }

  customSelect.setAttribute("tabindex", "0");

  const initialValue = customSelect.dataset.value || "1000";
  const initialOption = customSelect.querySelector(
    `[data-value="${initialValue}"]`
  );
  if (initialOption) {
    selectText.textContent = initialOption.textContent;
    selectOptions.forEach((opt) => opt.classList.remove("selected"));
    initialOption.classList.add("selected");
  }
}

// ==================== 应用初始化 ====================
/**
 * 初始化应用
 */
async function initApp() {
  try {
    initMap();

    const geoDataLoaded = await loadGeographicData();
    if (!geoDataLoaded) {
      throw new Error("地理数据加载失败");
    }

    trajectoryData = await loadTrajectoryData();

    if (trajectoryData && trajectoryData.events.length > 0) {
      const slider = document.getElementById("timeline-slider");
      if (slider) {
        slider.max = trajectoryData.events.length - 1;
        slider.style.transition = `all ${animationConfig.timelineDuration}ms ease`;
      }

      const totalCountEls = document.querySelectorAll(
        "[id^='total-event-count']"
      );
      totalCountEls.forEach((el) => {
        if (el) el.textContent = trajectoryData.events.length;
      });

      updateStatistics();
      showEventAtIndex(0, false);
    } else {
      throw new Error("轨迹数据为空");
    }

    bindEvents();
    hideLoading();

    const mapEl = document.getElementById("map");
    if (isMobileDevice()) {
      mapEl.classList.add("panel-visible");
    }
  } catch (error) {
    console.error("应用初始化失败:", error);
  }
}

// ==================== 启动应用 ====================
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
