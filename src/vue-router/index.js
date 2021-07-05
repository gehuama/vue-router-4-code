import { createWebHashHistory } from "./history/hash";
import { createWebHistory } from "./history/html5";
import { shallowRef, computed, reactive, unref } from "vue";

// 数据处理 option.routes 是用户的配置 ，难理解不好维护
// /  => record {Home}
// /a => record {A, parent.home}
// /b => record {B, parent.home}
// /about => record {About}

// 当用户访问 /a 的时候 会渲染Home 和A

// 格式化用户的参数
function normalizeRouteRecord(record) {
  return {
    path: record.path, // 状态机 解析路径的分数，算出匹配规则
    meta: record.meta || {},
    beforeEnter: record.beforeEnter || {},
    name: record.name,
    components: {
      default: record.component, // 循环
    },
    children: record.children || [],
  };
}
// 创造匹配记录，构建父子关系
function createRouteRecordMatcher(record, parent) {
  // record 中的path做了些修改 正则的情况
  const matcher = {
    path: record.path,
    record,
    parent,
    children: [],
  };
  if (parent) {
    parent.children.push(matcher);
  }
  return matcher;
}
// 树的遍历
function createRouterMatcher(routes) {
  const matchers = [];
  function addRoute(route, parent) {
    let normalizedRecord = normalizeRouteRecord(route);
    if (parent) {
      normalizedRecord.path = parent.path + normalizedRecord.path;
    }
    const matcher = createRouteRecordMatcher(normalizedRecord, parent);
    if ("children" in normalizedRecord) {
      let children = normalizedRecord.children;
      for (let i = 0; i < children.length; i++) {
        addRoute(children[i], matcher);
      }
    }
    matchers.push(matcher);
  }
  routes.forEach((route) => addRoute(route));
  // 解析 {path: /, matched:HomeRecord} {path:/a,matched:{HomeRecord, aRecord}}
  function resolve(location) {
    const matched = []; // / /a
    let path = location.path;
    let matcher = matchers.find((m) => m.path == path);
    while (matcher) {
      matched.unshift(matcher.record); // 将用户的原始数据放到matched中
      matcher = matchers.parent;
    }
    return {
      path: path,
      matched,
    };
  }
  return {
    resolve,
    addRoute, // 动态添加路由， 面试问 路由如何动态添加 就是这个api
  };
}
const START_LOCATION_NORMALIZED = {
  // 初始化路由系统中的默认参数
  path: "/",
  // params: {}, // 路由参数
  // query: {},
  matched: [], // 当前匹配到的记录
};
function createRouter(options) {
  const routerHistory = options.history;
  const matcher = createRouterMatcher(options.routes); // 格式化路由的配置 拍平

  // TODO 这里没有理解
  // 后续改变这个数据的value 就可以更新视图了
  const currentRoute = shallowRef(START_LOCATION_NORMALIZED); // obj.value = reactive(响应式数据)

  console.log(routerHistory, matcher);

  // 将数据用计算属性 再次包裹

  // 解析路径 to= '/' to={path: '/'}
  function resolve(to) {
    if (typeof to === "string") {
      return matcher.resolve({ path: to });
    }
  }

  function finalizeNavigation(to, from) {
    if (from === START_LOCATION_NORMALIZED) {
      routerHistory.replace(to.path);
    } else {
      routerHistory.push(to.path);
    }
    currentRoute.value = to; // 更新最新的路径
  }
  // 通过路径匹配到对应的记录，更新currentRoute
  function pushWithRedirect(to) {
    const targetLocation = resolve(to);
    const from = currentRoute.value;
    // 路由的钩子 再跳转前我们可以做路由的拦截

    // 根据是不是第一次，来决定是push 还是replace
    finalizeNavigation(targetLocation, from);
    console.log(targetLocation, from);
  }
  function push(to) {
    return pushWithRedirect(to);
  }
  //
  const router = {
    push,
    replace() {},
    // 路由的核心就是 页面切换，重新渲染
    install(app) {
      let router = this;
      console.log("路由的安装", app);
      // vue2 中有两个属性 $router 里面包含的是方法 $route 里面包含是属性
      app.config.globalProperties.$router = router; // 方法
      // 属性
      Object.defineProperty(app.config.globalProperties, "$route", {
        enumerable: true,
        get: () => unref(currentRoute),
      });
      const reactiveRoute = {};
      for (let key in START_LOCATION_NORMALIZED) {
        reactiveRoute[key] = computed(() => currentRoute.value[key]);
      }
      // vuex const store = useStore();
      app.provide("router", router); // 暴露路由对象
      app.provide("route location", reactive(reactiveRoute)); // 用于实现 useApi
      // let router = useRouter(); // inject('router');
      // let route = useRoute(); // inject('route location');
      app.component("RouterLink", {
        setup:
          (_props, { slots }) =>
          () =>
            <a>{slots.default && slots.default()}</a>,
      });
      app.component("RouterView", {
        setup:
          (_props, { slots }) =>
          () =>
            <div>{slots}</div>,
      });

      if (currentRoute.value == START_LOCATION_NORMALIZED) {
        // 默认初始化 ， 需要通过路由系统先进行一次跳转 发生匹配
        push(routerHistory.location);
      }

      // 后面还有逻辑

      // 解析路径 RouterLink RouterView 实现 页面钩子 从离开到进入 到解析完成
    },
  };
  return router;
}
export { createWebHashHistory, createWebHistory, createRouter };
