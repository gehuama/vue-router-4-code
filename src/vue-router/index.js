import { createWebHashHistory } from "./history/hash";
import { createWebHistory } from "./history/html5";

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
    if(parent){
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
  console.log(matcher);
}

function createRouter(options) {
  const routerHistory = options.history;
  const matcher = createRouterMatcher(options.routes);

  console.log(matcher, routerHistory); // 格式化路由的配置 拍平
  const router = {
    install(app) {
      // 路由的核心就是 页面切换，重新渲染
      console.log("路由的安装", app);
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
    },
  };
  return router;
}
export { createWebHashHistory, createWebHistory, createRouter };
