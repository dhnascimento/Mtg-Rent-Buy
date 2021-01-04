//Business Logic Controller

// UI Controller
const UIController = function () {
  //Getting the variables from the input fields
  const DOMstrings = {
    inputBtn: ".add__btn",
    inputHouseValue: ".add__house_value",
    inputDownPayment: ".add__down_payment",
    inputRate: ".add__interest_rate",
    inputAmort: ".add__amort_period",
    inputIsToronto: ".add__is_toronto",
    inputTitleInsurance: ".add__title_insurance",
    inputLegalFees: ".add__legal_fees",
    inputHomeInspection: ".add__home_inspection",
    inputComissionRate: ".add__comission_rate",
    inputMaintenanceRate: ".add__maitenance_rate",
    inputPropertyTax: ".add__property_tax",
    inputHouseInsurance: ".add__house_insurance",
    inputAppreciationRate: ".add__appreciation_rate",
  };
};

//Global App Controller
const controller = (function (UICtrl) {
  const setupEventListeners = function () {
    const DOM = UICtrl.getDOMstrings();
    document.querySelector(DOM.inputBtn).addEventListener("click", ctrlAddItem);
    document.addEventListener("keypress", function (event) {
      if (event.keyCode === 13 || event.which === 13) {
        ctrlAddItem();
      }
    });
  };

  const ctrlAddItem = function () {};

  return {
    init: function () {
      setupEventListeners();
    },
  };
})(UIController);

controller.init();
