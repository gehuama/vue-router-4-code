import { h, inject, provide, computed } from "vue";

export const RouterView = {
  name: "RouterView",
  // props:{
  //     name
  // }
  setup(props, { slots }) {
    // setup 只会执行一次
    const depth = inject("depth", 0);
    const injectRoute = inject("route location");
    const matchedRouteRef = computed(() => injectRoute.matched[depth]);
    provide("depth", depth + 1);
    return () => {
      // a [home a]
      const matchedRoute = matchedRouteRef.value; // record
      const viewComponent = matchedRoute && matchedRoute.components.default;
      if (!viewComponent) {
        return slots.default && slots.default();
      }
      return h(viewComponent);
    };
  },
};
