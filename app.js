// amortPeriod: 0
// appreciationRate: NaN
// comissionRate: NaN
// cpiRate: NaN
// downPayment: NaN
// homeInspection: NaN
// houseInsurance: NaN
// houseValue: NaN
// interestRate: NaN
// investmentReturns: NaN
// isToronto: true
// legalFees: NaN
// maintenanceRate: NaN
// propertyTax: NaN
// rentValue: NaN
// rentersInsurance: NaN
// titleInsurance: NaN

//Business Logic Controller
const Rent = (function () {
  return {
    simulate: function (input) {
      // Cost of renting
      const factors = [...Array(input.amortPeriod + 1).keys()]
      const currentYear = new Date().getFullYear();
      let yearlyRentValue = input.rentValue * 12 * (1 + input.rentersInsurance);
      const table = factors.map(function(factor) {
        return {
          year: factor + currentYear,
          costRent: Rent.computeCostRent(yearlyRentValue, input.cpiRate, factor) 
        }
      })
      console.log(table);
    }, 

    computeCostRent: function (rentValue, cpiRate, factor) {        
      return Math.round(rentValue * (Math.pow(1 + cpiRate, factor)) * 100) / 100;
    },
    
    // Surplus vs owning (annual)
    
    // Investment portfolio
  } 
})();

// UI Controller
const UIController = (function () {
  //Getting the variables from the input fields
  const DOMstrings = {
    //Owning Case
    inputBtn: ".add__btn",
    inputHouseValue: ".add__house_value",
    inputDownPayment: ".add__down_payment",
    inputRate: ".add__interest_rate",
    inputAmort: ".add__amort_period",
    inputIsToronto: "input[name=gridRadios]:checked",
    inputTitleInsurance: ".add__title_insurance", //
    inputLegalFees: ".add__legal_fees",
    inputHomeInspection: ".add__home_inspection", //
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
        isToronto:
          document.querySelector(DOMstrings.inputIsToronto).value === "true"
            ? true
            : false,
        titleInsurance: parseFloat(
          document
            .querySelector(DOMstrings.inputTitleInsurance)
            .value.replace(/(?!\.)\D/g, "")
        ),
        legalFees: parseFloat(
          document
            .querySelector(DOMstrings.inputLegalFees)
            .value.replace(/(?!\.)\D/g, "")
        ),
        homeInspection: parseFloat(
          document
            .querySelector(DOMstrings.inputHomeInspection)
            .value.replace(/(?!\.)\D/g, "")
        ),
        comissionRate: parseFloat(
          document
            .querySelector(DOMstrings.inputComissionRate)
            .value.replace(/(?!\.)\D/g, "")
        ),
        maintenanceRate: parseFloat(
          document
            .querySelector(DOMstrings.inputMaintenanceRate)
            .value.replace(/(?!\.)\D/g, "")
        ),
        propertyTax: parseFloat(
          document
            .querySelector(DOMstrings.inputPropertyTax)
            .value.replace(/(?!\.)\D/g, "")
        ),
        houseInsurance: parseFloat(
          document
            .querySelector(DOMstrings.inputHouseInsurance)
            .value.replace(/(?!\.)\D/g, "")
        ),
        appreciationRate: parseFloat(
          document
            .querySelector(DOMstrings.inputAppreciationRate)
            .value.replace(/(?!\.)\D/g, "")
        ),
        // Renting Case
        rentValue: parseFloat(
          document
            .querySelector(DOMstrings.inputRentValue)
            .value.replace(/(?!\.)\D/g, "")
        ),
        investmentReturns: parseFloat(
          document
            .querySelector(DOMstrings.inputInvestmentReturns)
            .value.replace(/(?!\.)\D/g, "")
        ),
        cpiRate: (
          parseFloat(
            document
              .querySelector(DOMstrings.inputCpiRate)
              .value.replace(/(?!\.)\D/g, "")
          ) / 100
        ),
        rentersInsurance: (
          parseFloat(
            document
              .querySelector(DOMstrings.inputRentersInsurance)
              .value.replace(/(?!\.)\D/g, "")
          ) / 100
        ),
      };
    },

    addElement: function (parentId, elementTag, elementId, html) {
      // Adds an element to the document
      const p = document.getElementById(parentId);
      const newElement = document.createElement(elementTag);
      newElement.setAttribute("id", elementId);
      newElement.innerHTML = html;
      p.appendChild(newElement);
    },
  };
})();

//Global App Controller
const controller = (function (UICtrl) {
  const setupEventListeners = function () {
    const DOM = UICtrl.getDOMstrings();
    console.log(DOM);
    console.log("Before Click");
    document.querySelector(DOM.inputBtn).addEventListener("click", ctrlAddItem);
    console.log("After Click");
    document.addEventListener("keypress", function (event) {
      if (event.keyCode === 13 || event.which === 13) {
        console.log("Passed if statement");
        ctrlAddItem();
        console.log("Called ctrlAddItem");
      }
    });
  };

  const ctrlAddItem = function () {
    const input = UICtrl.getInput();
    const rent = Rent.simulate(input);
    // const buy = Buy.simulate(input);
    // console.log("INPUT", input);
  };

  return {
    init: function () {
      setupEventListeners();
    },
  };
})(UIController);

controller.init();
