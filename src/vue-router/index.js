import { createWebHashHistory } from "./history/hash";
import { createWebHistory } from "./history/html5";
import { createRouterMatcher } from "./matcher";
import { shallowRef, computed, reactive, unref } from "vue";
import { RouterLink } from "./router-link";
import { RouterView } from "./router-view";

// 数据处理 option.routes 是用户的配置 ，难理解不好维护
// /  => record {Home}
// /a => record {A, parent.home}
// /b => record {B, parent.home}
// /about => record {About}

// 当用户访问 /a 的时候 会渲染Home 和A

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

  // 将数据用计算属性 再次包裹

  // 解析路径 to= '/' to={path: '/'}
  function resolve(to) {
    if (typeof to === "string") {
      return matcher.resolve({ path: to });
    }
  }
  let ready;
  // 用来标记已经渲染完毕
  function markAsRead() {
    if (ready) return;
    ready = true; // 用来标记已经渲染完毕了
    routerHistory.listen((to) => {
      const targetLocation = resolve(to);
      const from = currentRoute.value;
      finalizeNavigation(targetLocation, from, true); // 在切换前进后退，采用替换模式replaced 不是push模式
    });
  }
  function finalizeNavigation(to, from, replaced) {
    if (from === START_LOCATION_NORMALIZED || replaced) {
      routerHistory.replace(to.path);
    } else {
      routerHistory.push(to.path);
    }
    currentRoute.value = to; // 更新最新的路径
    console.log(currentRoute.value);
    markAsRead();
    // 如果是初始化我们还需要注入一个listen 去更新currentRoute的值，这样数据变化后可以更新重新渲染
  }
  // 通过路径匹配到对应的记录，更新currentRoute
  function pushWithRedirect(to) {
    const targetLocation = resolve(to);
    const from = currentRoute.value;
    // 路由的钩子 再跳转前我们可以做路由的拦截

    // 根据是不是第一次，来决定是push 还是replace
    finalizeNavigation(targetLocation, from);
  }
  function push(to) {
    return pushWithRedirect(to);
  }
  //
  const router = {
    push,
    // 路由的核心就是 页面切换，重新渲染
    install(app) {
      let router = this;
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

      app.component("RouterLink", RouterLink);
      app.component("RouterView", RouterView);

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
