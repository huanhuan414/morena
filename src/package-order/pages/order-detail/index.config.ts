export default typeof definePageConfig === "function"
  ? definePageConfig({
      navigationBarTitleText: "订单详情",
      navigationStyle: "custom",
    })
  : {
      navigationBarTitleText: "订单详情",
      navigationStyle: "custom",
    };
