//Business Logic Controller

// UI Controller
const UIController = function () {
  //Getting the variables from the input fields
  const DOMstrings = {
    //Owning Case
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
    inputMaintenanceRate: ".add__maintenance_rate",
    inputPropertyTax: ".add__property_tax",
    inputHouseInsurance: ".add__house_insurance",
    inputAppreciationRate: ".add__appreciation_rate",
    // Renting Case
    inputRentValue: ".add__rent_value",
    inputInvestmentReturns: ".add__investment_returns",
    inputCpiRate: ".add__cpi_rate",
    inputRentersInsurance: ".add__renters_insurance",
  };

  // This version of the code is to ensure I'm getting the right inputs
  return {
    getDOMstrings: function () {
      return DOMstrings;
    },
    getInput: function () {
      return {
        // Owning Case
        houseValue: parseFloat(
          document
            .querySelector(DOMstrings.inputHouseValue)
            .value.replace(/(?!\.)\D/g, "")
        ),
        downPayment: parseFloat(
          document
            .querySelector(DOMstrings.inputDownPayment)
            .value.replace(/(?!\.)\D/g, "")
        ),
        interestRate: parseFloat(
          document
            .querySelector(DOMstrings.inputRate)
            .value.replace(/(?!\.)\D/g, "")
        ),
        amortPeriod: parseFloat(
          document.querySelector(DOMstrings.inputAmort).value
        ),
        isToronto: document.querySelector(DOMstrings.inputIsToronto).value,
        titleInsurance: parseFloat(
          document.querySelector(DOMstrings.inputTitleInsurance)
        ).value.replace(/(?!\.)\D/g, ""),
        legalFees: parseFloat(
          document.querySelector(DOMstrings.inputLegalFees)
        ).value.replace(/(?!\.)\D/g, ""),
        homeInspection: parseFloat(
          document.querySelector(DOMstrings.inputHomeInspection)
        ).value.replace(/(?!\.)\D/g, ""),
        comissionRate: parseFloat(
          document.querySelector(DOMstrings.inputComissionRate)
        ).value.replace(/(?!\.)\D/g, ""),
        maintenanceRate: parseFloat(
          document.querySelector(DOMstrings.inputMaintenanceRate)
        ).value.replace(/(?!\.)\D/g, ""),
        propertyTax: parseFloat(
          document.querySelector(DOMstrings.inputPropertyTax)
        ).value.replace(/(?!\.)\D/g, ""),
        houseInsurance: parseFloat(
          document.querySelector(DOMstrings.inputHouseInsurance)
        ).value.replace(/(?!\.)\D/g, ""),
        appreciationRate: parseFloat(
          document.querySelector(DOMstrings.inputAppreciationRate)
        ).value.replace(/(?!\.)\D/g, ""),
        // Renting Case
        rentValue: parseFloat(
          document.querySelector(DOMstrings.inputRentValue)
        ).value.replace(/(?!\.)\D/g, ""),
        investmentReturns: parseFloat(
          document.querySelector(DOMstrings.inputInvestmentReturns)
        ).value.replace(/(?!\.)\D/g, ""),
        cpiRate: parseFloat(
          document.querySelector(DOMstrings.inputCpiRate)
        ).value.replace(/(?!\.)\D/g, ""),
        rentersInsurance: parseFloat(
          document.querySelector(DOMstrings.inputRentersInsurance)
        ).value.replace(/(?!\.)\D/g, ""),
      };
    },
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
