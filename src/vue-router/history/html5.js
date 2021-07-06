// 前端路由的实现原理，两种模式，一种hash模式，一种history模式
// h5api:
// window.location.hash = "/"; history.pushState(state,null,url) history.replaceState(state,null,url)
// 目前浏览器 都兼容 history.pushState history.pushState(state,null,url)
// history.pushState(state,null,"#/")

// 两种路由的区别：
// hash hash模式的好处， 就是锚点，刷新页面的时候不会向服务器发送请求，同时它不支持服务端渲染（不能做seo优化），
// 不会产生404，忒丑
// history 特点就是路径漂亮，没有#和正常页面切换一样， 如果刷新页面会向服务器发送请求 如果资源不存在，会出现404
// 解决方案 渲染首页，首页会根据路径重新跳转

// 实现一个路由核心模块
/**
 * back // 后退后
 * current, // 当前
 * forward, // 去哪里
 * replace, // 方式 push replace
 * computedScroll // 滚动条位置
 *
 */
function buildState(
  back,
  current,
  forward,
  replace = false,
  computedScroll = false
) {
  return {
    back,
    current,
    forward,
    replace,
    scroll: computedScroll
      ? { left: window.pageXOffset, top: window.pageYOffset }
      : null,
    position: window.history.length - 1,
  };
}
function createCurrentLocation(base) {
  const { pathname, search, hash } = window.location;
  const hasPos = base.indexOf("#"); // 就是hash模式  / /about #/ #/about
  if (hasPos > -1) {
    return base.slice(1) || "/";
  }
  return pathname + search + hash;
}
function useHistoryStateNavigation(base) {
  const currentLocation = {
    value: createCurrentLocation(base),
  };
  const historyState = {
    value: window.history.state,
  };
  // 第一次刷新页面 此时没有任何状态，那么我就自己维护一个状态 （后退后是哪个路径、当前路径是哪个、要去那里，
  // 我是用的push跳转还是replace跳转，跳转后滚动条位置是哪）
  if (!historyState.value) {
    changeLocation(
      currentLocation.value,
      buildState(null, currentLocation.value, null, true),
      true
    );
  }
  function changeLocation(to, state, replace) {
    const hasPos = base.indexOf("#");
    const url = hasPos > -1 ? base + to : to;
    window.history[replace ? "replaceState" : "pushState"](state, null, url);
    historyState.value = state; //将自己生成的状态同步到了 路由系统中
  }
  function push(to, data) {
    // 去哪，带的新的状态是谁？
    // 跳转时 需要做两个状态
    // a->b
    // 跳转前 从哪去哪，
    const currentState = Object.assign(
      {},
      historyState.value, // 当前状态
      {
        forward: to,
        scroll: { left: window.pageXOffset, top: window.pageYOffset },
      }
    );
    // 本质没有跳转的 只是更新了状态，后续在vue中我可以详细的监控到状态的变化
    changeLocation(currentState.current, currentState, true);

    const state = Object.assign(
      {},
      buildState(currentLocation.value, to, null),
      { position: currentState.position + 1 },
      data
    );
    changeLocation(to, state, false); // 真正的更改路径
    changeLocation.value = to;

    // 跳转后 从这到了哪
  }
  function replace(to, data) {
    const state = Object.assign(
      {},
      buildState(historyState.value.back, to, historyState.value.forward, true),
      data
    );
    changeLocation(to, state, true);
    currentLocation.value = to; // 替换后需要将路径改变为现在的路径
  }
  return {
    location: currentLocation,
    state: historyState,
    push,
    replace,
  };
}

// 前进后退的时候 要更新historyState，currentLocation 这两个变量
function useHistoryListeners(base, historyState, currentLocation) {
  let listeners = [];
  const popStateHandler = ({ state }) => {
    // 最新的状态，已经前进后退 完成后的状态
    const to = createCurrentLocation(base); // 去哪
    const from = currentLocation.value; // 从哪来
    const fromState = historyState.value; // 从哪来的状态

    currentLocation.value = to;
    historyState.value = state; // state 可能会为null

    let isBack = state.position - fromState.position < 0; // 判断是前进还是后退

    // 用户在这里扩展......
    listeners.forEach((listener) => {
      listener(to, from, { isBack });
    });
  };
  window.addEventListener("popstate", popStateHandler); //只能监听浏览器前进后退
  function listen(cb) {
    listeners.push(cb);
  }
  return {
    listen,
  };
}
// 1. 路由系统最基本的得包含当前的路径，当前路径下地状态是什么 需要提供两个切换路径的方法 push replace
// 2. 实现路由监听，如果路径变化 需要通知用户
export function createWebHistory(base = "") {
  // 1. 路由系统最基本的得包含当前的路径，当前路径下地状态是什么 需要提供两个切换路径的方法 push replace
  const historyNavigation = useHistoryStateNavigation(base);

  // 2. 实现路由监听，如果路径变化 需要通知用户
  const historyListeners = useHistoryListeners(
    base,
    historyNavigation.state,
    historyNavigation.location
  );

  const routerHistory = Object.assign({}, historyNavigation, historyListeners);
  Object.defineProperty(routerHistory, "location", {
    get: () => historyNavigation.location.value,
  });
  Object.defineProperty(routerHistory, "state", {
    get: () => historyNavigation.state.value,
  });
  return routerHistory;
}
