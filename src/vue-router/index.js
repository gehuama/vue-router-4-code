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
//
function useCallback() {
  const handlers = [];
  function add(handler) {
    handlers.push(handler);
  }
  return {
    add, // 添加方法
    list: () => handlers, // 获取方法
  };
}
// 计算哪些是正在离开中记录、哪些是正在进入中记录，哪些是正在更新中记录
function extractChangeRecords(to, from) {
  const leavingRecords = [];
  const updatingRecords = [];
  const enteringRecords = [];
  const len = Math.max(to.matched.length, from.matched.length);
  for (let i = 0; i < len; i++) {
    const recordFrom = from.matched[i];
    if (recordFrom) {
      // 如果去的和来的都有 那么就是要更新
      if (to.matched.find((record) => record.path == recordFrom.path)) {
        updatingRecords.push(recordFrom);
      } else {
        // 如果去的有，离开的没有，那么就是离开
        leavingRecords.push(recordFrom);
      }
    }
    const recordTo = to.matched[i];
    if (recordTo) {
      // 如果来的里面不包含去的 那么就是要进入
      if (!from.matched.find((record) => record.path == recordTo.path)) {
        enteringRecords.push(recordTo);
      }
    }
  }
  return [leavingRecords, updatingRecords, enteringRecords];
}

function guardToPromise(guard, to, from, record) {
  return () => {
    new Promise((resolve) => {
      const next = () => resolve();
      let guardReturn = guard.call(record, to, from, next);
      // 如果用户没有调用next 我在return前自动调next,
      // 如果不调用next，最终结果会next调用 因此用户就可以在调用next方法
      return Promise.resolve(guardReturn).then(next);
    });
  };
}

function extractComponentsGuards(matched, guardType, to, from) {
  const guards = [];
  for (const record of matched) {
    // 获取这条记录中的组件
    let rawComponent = record.components.default;
    // 当guardType 为 beforeRouteLeave 是 通过当前组件获取 beforeRouteLeave
    const guard = rawComponent[guardType];
    // 如果当前这个组件路由存在把这个路由放入其中
    // 这里需要考虑：需要将钩子 全部串联在一起 如何串联 采用链式调用, 因此将其转化成promise
    guard && guards.push(guardToPromise(guard, to, from, record));
  }
  return guards;
}

// 一次执行guards的记录
// promise的组合函数
function runGuardQueue(guards) {
  // [fn()=>promise, fn=>promise]
  return guards.reduce(
    (promise, guard) => promise.then(() => guard()),
    Promise.resolve()
  );
}
function createRouter(options) {
  const routerHistory = options.history;
  const matcher = createRouterMatcher(options.routes); // 格式化路由的配置 拍平

  // TODO 这里没有理解
  // 后续改变这个数据的value 就可以更新视图了
  const currentRoute = shallowRef(START_LOCATION_NORMALIZED); // obj.value = reactive(响应式数据)

  const beforeGuards = useCallback();
  const beforeResolveGuards = useCallback();
  const afterGuards = useCallback();

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

  async function navigate(to, from) {
    // 在做导航的时候 我要知道哪个组件是进入的，哪个组件是离开的，还应知道哪个组件是更新的
    // 例如 由/home/a/b  进入到 /home/a/c
    const [leavingRecords, updatingRecords, enteringRecords] =
      extractChangeRecords(to, from);

    // 离开的时候，需要由后往前  例如： home/a 切换 about 此过程 a组件要销毁，home要销毁 缓存 about 因此需要倒序
    let guards = extractComponentsGuards(
      leavingRecords.reverse(),
      "beforeRouteLeave",
      to,
      from
    );
    return runGuardQueue(guards)
      .then(() => {
        // 全局路由钩子 beforeEach
        guards = [];
        for (const guard of beforeGuards.list()) {
          guards.push(guardToPromise(guard, to, from, guard));
        }
        return runGuardQueue(guards);
      })
      .then(() => {
        // 路由钩子 beforeRouteUpdate
        guards = extractComponentsGuards(
          updatingRecords,
          "beforeRouteUpdate",
          to,
          from
        );
        return runGuardQueue(guards);
      })
      .then(() => {
        // beforeEnter的时候 ？？？
        guards = [];
        for (const record of to.matched) {
          if (record.beforeEnter) {
            guards.push(guardToPromise(record.beforeEnter, to, from, record));
          }
        }
        return runGuardQueue(guards);
      })
      .then(() => {
        // 路由钩子 beforeRouteEnter
        guards = [];
        guards = extractComponentsGuards(
          enteringRecords,
          "beforeRouteEnter",
          to,
          from
        );
        return runGuardQueue(guards);
      })
      .then(() => {
        // 全局路由钩子 beforeResolve的时候
        guards = [];
        for (const guard of beforeResolveGuards.list()) {
          guards.push(guardToPromise(guard, to, from, guard));
        }
        return runGuardQueue(guards);
      });
  }
  // 通过路径匹配到对应的记录，更新currentRoute
  function pushWithRedirect(to) {
    const targetLocation = resolve(to);
    const from = currentRoute.value;
    // 路由的钩子 再跳转前我们可以做路由的拦截

    // 路由导航守卫 有：全局钩子 路由钩子 组件上的钩子
    navigate(targetLocation, from)
      .then(() => {
        // 根据是不是第一次，来决定是push 还是replace
        return finalizeNavigation(targetLocation, from);
      })
      .then(() => {
        // 当导航切换完毕后执行 afterEach
        for (const guard of afterGuards.list()) {
          guard(to, from);
        }
      });
  }
  function push(to) {
    return pushWithRedirect(to);
  }
  //
  const router = {
    push,
    beforeEach: beforeGuards.add, // 全局守卫beforeEach 可以注册多个 所哟是一个发布订阅模式
    afterEach: afterGuards.add, // 全局守卫afterEach 可以注册多个 所哟是一个发布订阅模式
    beforeResolve: beforeResolveGuards.add, // 全局守卫beforeResole 可以注册多个 所哟是一个发布订阅模式
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

      console.log(beforeGuards.list());
    },
  };
  return router;
}
export { createWebHashHistory, createWebHistory, createRouter };
