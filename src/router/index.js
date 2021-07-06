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

export default router;
