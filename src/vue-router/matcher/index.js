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
      matcher = matcher.parent;
    }
    return {
      path,
      matched,
    };
  }
  return {
    resolve,
    addRoute, // 动态添加路由， 面试问 路由如何动态添加 就是这个api
  };
}

export { createRouterMatcher };
