// amortPeriod:
// appreciationRate:
// comissionRate:
// cpiRate:
// downPayment:
// homeInspection:
// houseInsurance:
// houseValue:
// interestRate:
// investmentReturns:
// isToronto: true
// legalFees:
// maintenanceRate:
// propertyTax:
// rentValue:
// rentersInsurance:
// titleInsurance:

//Business Logic Controller
const Rent = (function () {
  return {
    simulate: function (input) {
      // Cost of renting
      const years = [...Array(input.amortPeriod + 1).keys()];
      const currentYear = new Date().getFullYear();
      let yearlyRentValue = input.rentValue * 12 * (1 + input.rentersInsurance);
      const table = years.map(function (factor) {
        return {
          year: factor + currentYear,
          costRent: Rent.computeCostRent(
            yearlyRentValue,
            input.cpiRate,
            factor
          ),
        };
      });
      return table;
    },

    computeCostRent: function (rentValue, cpiRate, factor) {
      return Math.round(rentValue * Math.pow(1 + cpiRate, factor) * 100) / 100;
    },

    // Surplus vs owning (annual)

    // Investment portfolio
  };
})();

const Owning = (function () {
  return {
    houseValue: function (purchasePrice, appreciationRate, factor) {
      return (
        Math.round(
          purchasePrice * Math.pow(1 + appreciationRate, factor) * 100
        ) / 100
      );
    },

    PMT: function (ir, np, pv, fv, type) {
      /*
      Taken from the kindly Stack Overflow user: Vault
       * ir   - interest rate per month
       * np   - number of periods (months)
       * pv   - present value
       * fv   - future value
       * type - when the payments are due:
       *        0: end of the period, e.g. end of month (default)
       *        1: beginning of period
       */
      var pmt, pvif;

      fv || (fv = 0);
      type || (type = 0);

      if (ir === 0) return -(pv + fv) / np;

      pvif = Math.pow(1 + ir, np);
      pmt = (-ir * pv * (pvif + fv)) / (pvif - 1);

      if (type === 1) pmt /= 1 + ir;

      return pmt;
    },

    effectiveMonthlyRate: function (rate) {
      return Math.pow(Math.pow(rate / 2 + 1, 2), 1 / 12) - 1;
    },

    // Mortgage balance for a specifc month
    // https://money.stackexchange.com/questions/117399/compute-loan-balance-for-a-specific-month-period-on-an-amortized-loan
    //
    balanceOnPeriod: function (pv, rate, pmt, period) {
      return (
        (1 + rate) ** period * pv - ((1 + rate) ** period - 1) * (pmt / rate)
      );
    },

    // Calcultate all PMTs for a payment schedule with variable interest rate
    getPMTs: function (pv, period, rate, rateFive, rateTen) {
      const PMTInit = -Owning.PMT(rate, period, pv, 0, 0);
      const balanceFive = Owning.balanceOnPeriod(pv, rate, PMTInit, 60);
      const PMTFive = -Owning.PMT(rateFive, period - 60, balanceFive, 0, 0);
      const balanceTen = Owning.balanceOnPeriod(
        balanceFive,
        rateFive,
        PMTFive,
        60
      );
      const PMTTen = -Owning.PMT(rateTen, period - 120, balanceTen, 0, 0);
      if (period > 120) {
        return { PMTInit, PMTFive, PMTTen };
      } else if (period > 60) {
        return { PMTInit, PMTFive };
      } else {
        return { PMTInit };
      }
    },

    getCMHCInsurance: function (downpayment, amortzationYears) {
      if (amortzationYears > 25) {
        if (downpayment >= 0.2) return 0;
        if (downpayment >= 0.15) return 0.0195;
        if (downpayment >= 0.1) return 0.022;
        if (downpayment >= 0.05) return 0.0295;
        if (downpayment < 0.05) return 1;
      } else {
        if (downpayment >= 0.2) return 0;
        if (downpayment >= 0.15) return 0.018;
        if (downpayment >= 0.1) return 0.024;
        if (downpayment >= 0.05) return 0.0315;
        if (downpayment < 0.05) return 1;
      }
    },

    getOntarioLandTax: function (houseValue) {
      if (houseValue > 400000) {
        return 4475 + (houseValue - 400000) * 0.02;
      } else if (houseValue > 250000) {
        return 2225 + (houseValue - 250000) * 0.015;
      } else if (houseValue > 55000) {
        return 275 + (houseValue - 55000) * 0.01;
      } else {
        return houseValue * 0.005;
      }
    },

    getTorontoLandTax: function (houseValue) {
      if (houseValue > 400000) {
        return 3725 + (houseValue - 400000) * 0.02;
      } else if (houseValue > 55000) {
        return 275 + (houseValue - 55000) * 0.01;
      } else {
        return houseValue * 0.005;
      }
    },

    maintenanceCost: function (input) {
      const years = [...Array(input.amortPeriod + 1).keys()];
      const currentYear = new Date().getFullYear();
      const table = years.map(function (factor) {
        return {
          year: factor + currentYear,
          costMaintenance:
            Math.round(
              input.maintenanceRate *
                Owning.houseValue(
                  input.houseValue,
                  input.appreciationRate,
                  factor
                ) *
                100
            ) / 100,
        };
      });
      return table;
    },

    insuranceCost: function (input) {
      const years = [...Array(input.amortPeriod + 1).keys()];
      console.log("years", years);
      const currentYear = new Date().getFullYear();
      console.log("currentYear", currentYear);
      const table = years.map(function (factor) {
        return {
          year: factor + currentYear,
          costInsurance:
            Math.round(
              input.houseInsurance *
                Owning.houseValue(
                  input.houseValue,
                  input.appreciationRate,
                  factor
                ) *
                100
            ) / 100,
        };
      });
      return table;
    },

    propertyTaxCost: function (input) {
      const years = [...Array(input.amortPeriod + 1).keys()];
      const currentYear = new Date().getFullYear();
      const table = years.map(function (factor) {
        return {
          year: factor + currentYear,
          costPropertyTax:
            Math.round(
              input.propertyTax *
                Owning.houseValue(
                  input.houseValue,
                  input.appreciationRate,
                  factor
                ) *
                100
            ) / 100,
        };
      });
      return table;
    },

    annualCashOutlay: function (input) {
      const years = [...Array(input.amortPeriod + 1).keys()];
      const currentYear = new Date().getFullYear();

      const insurance = Owning.insuranceCost(input);
      const maintenance = Owning.maintenanceCost(input);
      const propertyTax = Owning.propertyTaxCost(input);
      const mortgage = Owning.mortgageCost(input);

      console.log({ maintenance, propertyTax, insurance, mortgage });

      const table = years.map(function (factor) {
        return {
          year: factor + currentYear,
          annualCashOutlay:
            insurance[factor]["costInsurance"] +
            propertyTax[factor]["costPropertyTax"] +
            maintenance[factor]["costMaintenance"] +
            12 * mortgage[factor]["mortgageCost"],
        };
      });
      console.log("cash", table);
      return table;
    },

    mortgageCost: function (input) {
      const CMHCInsurance = Owning.getCMHCInsurance(
        input.downPayment,
        input.amortPeriod
      );
      const years = [...Array(input.amortPeriod + 1).keys()];
      const currentYear = new Date().getFullYear();

      const amortizationMonths = input.amortPeriod * 12;
      const APR = input.interestRate;
      const interestInitial = Owning.effectiveMonthlyRate(APR);
      const interestFive = Owning.effectiveMonthlyRate(APR + 0.01);
      const interestTen = Owning.effectiveMonthlyRate(APR + 0.02);

      const mortgageValue =
        input.houseValue * (1 - input.downPayment) * (1 + CMHCInsurance);

      const payments = Owning.getPMTs(
        mortgageValue,
        amortizationMonths,
        interestInitial,
        interestFive,
        interestTen
      );

      const table = years.map(function (factor) {
        return {
          year: factor + currentYear,
          mortgageBalance: Owning.balanceOnPeriod(),
          mortgageCost:
            factor > 9
              ? payments.PMTTen
              : factor > 4
              ? payments.PMTFive
              : payments.PMTInit,
        };
      });
      return table;
    },
  };
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
        downPayment:
          parseFloat(
            document
              .querySelector(DOMstrings.inputDownPayment)
              .value.replace(/(?!\.)\D/g, "")
          ) / 100,
        interestRate:
          parseFloat(
            document
              .querySelector(DOMstrings.inputRate)
              .value.replace(/(?!\.)\D/g, "")
          ) / 100,
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
        maintenanceRate:
          parseFloat(
            document
              .querySelector(DOMstrings.inputMaintenanceRate)
              .value.replace(/(?!\.)\D/g, "")
          ) / 100,
        propertyTax:
          parseFloat(
            document
              .querySelector(DOMstrings.inputPropertyTax)
              .value.replace(/(?!\.)\D/g, "")
          ) / 100,
        houseInsurance:
          parseFloat(
            document
              .querySelector(DOMstrings.inputHouseInsurance)
              .value.replace(/(?!\.)\D/g, "")
          ) / 100,
        appreciationRate:
          parseFloat(
            document
              .querySelector(DOMstrings.inputAppreciationRate)
              .value.replace(/(?!\.)\D/g, "")
          ) / 100,
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
        cpiRate:
          parseFloat(
            document
              .querySelector(DOMstrings.inputCpiRate)
              .value.replace(/(?!\.)\D/g, "")
          ) / 100,
        rentersInsurance:
          parseFloat(
            document
              .querySelector(DOMstrings.inputRentersInsurance)
              .value.replace(/(?!\.)\D/g, "")
          ) / 100,
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
    console.log(input);
    const rent = Rent.simulate(input);
    const maintenance = Owning.maintenanceCost(input);
    const insurance = Owning.insuranceCost(input);
    const propertyTx = Owning.propertyTaxCost(input);
    const mortagePmt = Owning.mortgageCost(input);
    const cashOutlay = Owning.annualCashOutlay(input);
  };

  return {
    init: function () {
      setupEventListeners();
    },
  };
})(UIController);

controller.init();
