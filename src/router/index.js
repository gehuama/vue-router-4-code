import { createRouter, createWebHistory } from "@/vue-router";
import Home from "../views/Home.vue";
import About from "../views/About.vue";

const routes = [
  {
    path: "/",
    name: "Home",
    component: Home,
    children: [
      {
        path: "a",
        component: {
          render: () => {
            return <h1>A页面</h1>;
          },
        },
      }, // jsx 语法
      {
        path: "b",
        component: {
          render: () => {
            return <h1>B页面</h1>;
          },
        }, // jsx
      },
    ],
    beforeEnter: (to) => {
      // ...
      console.log("beforeEnter", to);
    },
  },
  {
    path: "/about",
    name: "About",
    component: About,
  },
];

const router = createRouter({
  // mode
  history: createWebHistory(),
  routes,
});

router.beforeEach((to) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log("beforeEach1", to);
      resolve();
    }, 1000);
  });
});
router.beforeEach((to) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log("beforeEach2", to);
      resolve();
    }, 1000);
  });
});
router.beforeEach((to) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log("beforeEach3", to);
      resolve();
    }, 1000);
  });
});
router.beforeResolve((to) => {
  // to and from are both route objects. must call `next`.
  console.log("beforeResolve", to);
});
router.afterEach((to) => {
  // to and from are both route objects.
  console.log("afterEach", to);
});
export default router;
