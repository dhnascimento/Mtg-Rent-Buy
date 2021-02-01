//Business Logic Controller
const Rent = (function () {
  return {
    totalCashPurchase: function (input) {
      const houseValue = input.houseValue;
      const downPayment = houseValue * input.downPayment;
      const ontarioLandTax = Owning.getOntarioLandTax(houseValue);
      const torontoLandTax = input.isToronto
        ? Owning.getTorontoLandTax(houseValue)
        : 0;
      const titleInsurance = input.titleInsurance;
      const legalFees = input.legalFees;
      const homeInspectionFee = input.homeInspection;

      return (
        downPayment +
        ontarioLandTax +
        torontoLandTax +
        titleInsurance +
        legalFees +
        homeInspectionFee
      );
    },

    rentCost: function (input) {
      // Cost of renting
      const years = [...Array(input.amortPeriod + 1).keys()];
      const currentYear = new Date().getFullYear();
      let yearlyRentValue = input.rentValue * 12;
      let yearlyFiveRentValue = Rent.yearlyRentCost(
        yearlyRentValue,
        input.cpiRateFive,
        5
      );
      let yearlyTenRentValue = Rent.yearlyRentCost(
        yearlyFiveRentValue,
        input.cpiRateTen,
        5
      );

      const table = years.map(function (factor) {
        let cpi =
          factor > 10
            ? input.cpiRateTwenty
            : factor > 5
            ? input.cpiRateTen
            : input.cpiRateFive;

        let rentersInsurance =
          factor > 10
            ? 1 + input.rentersInsuranceTwenty
            : factor > 5
            ? 1 + input.rentersInsuranceTen
            : 1 + input.rentersInsuranceFive;

        return {
          year: factor + currentYear,
          costRent:
            factor > 10
              ? Rent.yearlyRentCost(yearlyTenRentValue, cpi, factor - 10) *
                rentersInsurance
              : factor > 5
              ? Rent.yearlyRentCost(yearlyFiveRentValue, cpi, factor - 5) *
                rentersInsurance
              : Rent.yearlyRentCost(yearlyRentValue, cpi, factor) *
                rentersInsurance,
        };
      });
      return table;
    },

    yearlyRentCost: function (rentValue, cpiRate, factor) {
      //elapsed years?
      return Math.round(rentValue * Math.pow(1 + cpiRate, factor) * 100) / 100;
    },

    returnOnInvestment: function (portfolio, surplus, investmentReturn) {
      return (
        Math.round(portfolio * (1 + investmentReturn) * 100) / 100 +
        Math.round(surplus * (1 + investmentReturn / 2) * 100) / 100
      );
    },

    // Surplus vs owning (annual)
    surplusOnRent: function (input) {
      const years = [...Array(input.amortPeriod + 1).keys()];
      const currentYear = new Date().getFullYear();

      const cashOutlay = Owning.annualCashOutlay(input);
      const rent = Rent.rentCost(input);

      const table = years.map(function (factor) {
        return {
          year: factor + currentYear,
          surplus:
            cashOutlay[factor]["annualCashOutlay"] - rent[factor]["costRent"],
        };
      });
      return table;
    },

    // Investment portfolio
    investmentPortfolio: function (input) {
      const years = [...Array(input.amortPeriod + 1).keys()];
      const currentYear = new Date().getFullYear();

      // const investmentRate = input.investmentReturns;
      const surplus = Rent.surplusOnRent(input);
      const initialPortfolio = Rent.totalCashPurchase(input);

      let balance = initialPortfolio;
      let lastBalance = null;
      const table = years.map(function (factor) {
        let investmentRate =
          factor > 9
            ? input.investmentReturnsTwenty
            : factor > 4
            ? input.investmentReturnsTen
            : input.investmentReturnsFive;

        if (lastBalance) {
          balance = Rent.returnOnInvestment(
            lastBalance,
            surplus[factor - 1]["surplus"],
            investmentRate
          );
        }

        lastBalance = balance;

        return {
          year: factor + currentYear,
          portfolio: balance,
        };
      });
      return table;
    },

    RentingCase: function (input) {
      const years = [...Array(input.amortPeriod + 1).keys()];
      const currentYear = new Date().getFullYear();

      const costTable = Rent.rentCost(input);
      const surplusTable = Rent.surplusOnRent(input);
      const investmentTable = Rent.investmentPortfolio(input);

      const table = years.map(function (factor) {
        return {
          year: factor + currentYear,
          costOfRenting: costTable[factor]["costRent"],
          surplusVsOwning: surplusTable[factor]["surplus"],
          investmentPortfolio: investmentTable[factor]["portfolio"],
        };
      });
      return table;
    },
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

      const houseValue = Owning.ownerEquity(input);

      const table = years.map(function (factor) {
        let maintenanceRate =
          factor > 9
            ? input.maintenanceRateTwenty
            : factor > 4
            ? input.maintenanceRateTen
            : input.maintenanceRateFive;

        return {
          year: factor + currentYear,
          costMaintenance:
            factor > 10
              ? Math.round(
                  maintenanceRate * houseValue[factor]["houseValue"] * 100
                ) / 100
              : factor > 5
              ? Math.round(
                  maintenanceRate * houseValue[factor]["houseValue"] * 100
                ) / 100
              : Math.round(
                  maintenanceRate * houseValue[factor]["houseValue"] * 100
                ) / 100,
        };
      });
      return table;
    },

    insuranceCost: function (input) {
      const years = [...Array(input.amortPeriod + 1).keys()];
      const currentYear = new Date().getFullYear();

      const houseValue = Owning.ownerEquity(input);

      const table = years.map(function (factor) {
        let insuranceRate =
          factor > 9
            ? input.houseInsuranceTwenty
            : factor > 4
            ? input.houseInsuranceTen
            : input.houseInsuranceFive;

        return {
          year: factor + currentYear,
          costInsurance:
            factor > 10
              ? Math.round(
                  insuranceRate * houseValue[factor]["houseValue"] * 100
                ) / 100
              : factor > 5
              ? Math.round(
                  insuranceRate * houseValue[factor]["houseValue"] * 100
                ) / 100
              : Math.round(
                  insuranceRate * houseValue[factor]["houseValue"] * 100
                ) / 100,
        };
      });
      return table;
    },

    propertyTaxCost: function (input) {
      const years = [...Array(input.amortPeriod + 1).keys()];
      const currentYear = new Date().getFullYear();

      const houseValue = Owning.ownerEquity(input);

      const table = years.map(function (factor) {
        let propertyTax =
          factor > 9
            ? input.propertyTaxTwenty
            : factor > 4
            ? input.propertyTaxTen
            : input.propertyTaxFive;

        return {
          year: factor + currentYear,
          costPropertyTax:
            factor > 10
              ? Math.round(
                  propertyTax * houseValue[factor]["houseValue"] * 100
                ) / 100
              : factor > 5
              ? Math.round(
                  propertyTax * houseValue[factor]["houseValue"] * 100
                ) / 100
              : Math.round(
                  propertyTax * houseValue[factor]["houseValue"] * 100
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

      const table = years.map(function (factor) {
        return {
          year: factor + currentYear,
          annualCashOutlay:
            insurance[factor]["costInsurance"] +
            propertyTax[factor]["costPropertyTax"] +
            maintenance[factor]["costMaintenance"] +
            mortgage[factor]["mortgageCost"],
        };
      });
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
      // const APR = input.interestRate;
      const interestInitial = Owning.effectiveMonthlyRate(
        input.interestRateFive
      );
      const interestFive = Owning.effectiveMonthlyRate(input.interestRateTen);
      const interestTen = Owning.effectiveMonthlyRate(input.interestRateTwenty);

      const mortgageValue =
        input.houseValue * (1 - input.downPayment) * (1 + CMHCInsurance);

      const payments = Owning.getPMTs(
        mortgageValue,
        amortizationMonths,
        interestInitial,
        interestFive,
        interestTen
      );

      const balanceInitFive = Owning.balanceOnPeriod(
        Owning.balanceOnPeriod(
          mortgageValue,
          interestInitial,
          payments.PMTInit,
          60
        ),
        interestFive,
        payments.PMTFive,
        0
      );

      const balanceInitTen = Owning.balanceOnPeriod(
        Owning.balanceOnPeriod(
          balanceInitFive,
          interestFive,
          payments.PMTFive,
          60
        ),
        interestTen,
        payments.PMTTen,
        0
      );

      const table = years.map(function (factor) {
        return {
          year: factor + currentYear,
          mortgageBalance:
            factor > 10
              ? Owning.balanceOnPeriod(
                  balanceInitTen,
                  interestTen,
                  payments.PMTTen,
                  12 * (factor - 10)
                )
              : factor > 5
              ? Owning.balanceOnPeriod(
                  balanceInitFive,
                  interestFive,
                  payments.PMTFive,
                  12 * (factor - 5)
                )
              : Owning.balanceOnPeriod(
                  mortgageValue,
                  interestInitial,
                  payments.PMTInit,
                  12 * factor
                ),

          mortgageCost:
            12 *
            (factor == input.amortPeriod
              ? 0
              : factor > 9
              ? payments.PMTTen
              : factor > 4
              ? payments.PMTFive
              : payments.PMTInit),
        };
      });
      return table;
    },

    ownerEquity: function (input) {
      const years = [...Array(input.amortPeriod + 1).keys()];
      const currentYear = new Date().getFullYear();

      const mortgage = Owning.mortgageCost(input);

      let initalHouseValue = input.houseValue;
      let fiveYearsHouseValue = Owning.houseValue(
        initalHouseValue,
        input.appreciationRateFive,
        5
      );
      let tenYearsHouseValue = Owning.houseValue(
        fiveYearsHouseValue,
        input.appreciationRateTen,
        5
      );

      const table = years.map(function (factor) {
        let mortgageBalance = mortgage[factor]["mortgageBalance"];

        let appreciationRate =
          factor > 10
            ? input.appreciationRateTwenty
            : factor > 5
            ? input.appreciationRateTen
            : input.appreciationRateFive;

        return {
          year: factor + currentYear,
          value:
            factor > 10
              ? Math.round(
                  Owning.houseValue(
                    tenYearsHouseValue,
                    appreciationRate,
                    factor - 10
                  ) - mortgageBalance
                )
              : factor > 5
              ? Math.round(
                  Owning.houseValue(
                    fiveYearsHouseValue,
                    appreciationRate,
                    factor - 10
                  ) - mortgageBalance
                )
              : Math.round(
                  Owning.houseValue(
                    initalHouseValue,
                    appreciationRate,
                    factor
                  ) - mortgageBalance
                ),
          houseValue:
            factor > 10
              ? Owning.houseValue(
                  tenYearsHouseValue,
                  appreciationRate,
                  factor - 10
                )
              : factor > 5
              ? Owning.houseValue(
                  fiveYearsHouseValue,
                  appreciationRate,
                  factor - 5
                )
              : Owning.houseValue(initalHouseValue, appreciationRate, factor),
        };
      });
      console.log(table);
      return table;
    },

    OwningCase: function (input) {
      const years = [...Array(input.amortPeriod + 1).keys()];
      const currentYear = new Date().getFullYear();

      const mortgage = Owning.mortgageCost(input);
      const maintenance = Owning.maintenanceCost(input);
      const propertyTax = Owning.propertyTaxCost(input);
      const insurance = Owning.insuranceCost(input);
      const cashOutlay = Owning.annualCashOutlay(input);
      const ownerEquity = Owning.ownerEquity(input);

      const table = years.map(function (factor) {
        return {
          year: factor + currentYear,
          mortgage: mortgage[factor]["mortgageCost"],
          maintenance: maintenance[factor]["costMaintenance"],
          propertyTax: propertyTax[factor]["costPropertyTax"],
          insurance: insurance[factor]["costInsurance"],
          annualCashOutlay: cashOutlay[factor]["annualCashOutlay"],
          mortgageBalance: mortgage[factor]["mortgageBalance"],
          houseValue: ownerEquity[factor]["houseValue"],
          ownerEquity: ownerEquity[factor]["value"],
        };
      });
      return table;
    },
  };
})();

const Comparison = (function () {
  return {
    noSelling: function (input) {
      const years = [...Array(input.amortPeriod + 1).keys()];
      const currentYear = new Date().getFullYear();

      const ownerEquity = Owning.ownerEquity(input);
      const investment = Rent.investmentPortfolio(input);

      const table = years.map(function (factor) {
        return {
          year: factor + currentYear,
          comparison:
            investment[factor]["portfolio"].toFixed(0) -
            ownerEquity[factor]["value"].toFixed(0),
        };
      });
      return table;
    },

    //

    selling: function (input) {
      const years = [...Array(input.amortPeriod + 1).keys()];
      const currentYear = new Date().getFullYear();

      const owner = Owning.OwningCase(input);
      const rent = Rent.RentingCase(input);
      const investmentTaxRate = 0.1;

      let surplus = 0;

      const table = years.map(function (factor) {
        if (factor > 0) {
          surplus += rent[factor - 1]["surplusVsOwning"];
        }

        return {
          year: factor + currentYear,
          comparison:
            factor === 0
              ? rent[0]["investmentPortfolio"] -
                (owner[0]["houseValue"] -
                  owner[0]["houseValue"] * input.comissionRate -
                  owner[0]["mortgageBalance"])
              : -(
                  (rent[factor]["investmentPortfolio"] -
                    rent[0]["investmentPortfolio"] -
                    surplus) *
                  investmentTaxRate
                ) +
                rent[factor]["investmentPortfolio"] -
                (owner[factor]["houseValue"] -
                  owner[factor]["houseValue"] * input.comissionRate -
                  owner[factor]["mortgageBalance"]),
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
    inputRateFive: ".add__interest_rate_five",
    inputRateTen: ".add__interest_rate_ten",
    inputRateTwenty: ".add__interest_rate_twenty",
    inputAmort: ".add__amort_period",
    inputIsToronto: "input[name=gridRadios]:checked",
    inputTitleInsurance: ".add__title_insurance", //
    inputLegalFees: ".add__legal_fees",
    inputHomeInspection: ".add__home_inspection", //
    inputComissionRate: ".add__comission_rate",
    inputMaintenanceRateFive: ".add__maintenance_rate_five",
    inputMaintenanceRateTen: ".add__maintenance_rate_ten",
    inputMaintenanceRateTwenty: ".add__maintenance_rate_twenty",
    inputPropertyTaxFive: ".add__property_tax_five",
    inputPropertyTaxTen: ".add__property_tax_ten",
    inputPropertyTaxTwenty: ".add__property_tax_twenty",
    inputHouseInsuranceFive: ".add__house_insurance_five",
    inputHouseInsuranceTen: ".add__house_insurance_ten",
    inputHouseInsuranceTwenty: ".add__house_insurance_twenty",
    inputAppreciationRateFive: ".add__appreciation_rate_five",
    inputAppreciationRateTen: ".add__appreciation_rate_ten",
    inputAppreciationRateTwenty: ".add__appreciation_rate_twenty",
    // Renting Case
    inputRentValue: ".add__rent_value",
    inputInvestmentReturnsFive: ".add__investment_returns_five",
    inputInvestmentReturnsTen: ".add__investment_returns_ten",
    inputInvestmentReturnsTwenty: ".add__investment_returns_twenty",
    inputCpiRateFive: ".add__cpi_rate_five",
    inputCpiRateTen: ".add__cpi_rate_ten",
    inputCpiRateTwenty: ".add__cpi_rate_twenty",
    inputRentersInsuranceFive: ".add__renters_insurance_five",
    inputRentersInsuranceTen: ".add__renters_insurance_ten",
    inputRentersInsuranceTwenty: ".add__renters_insurance_twenty",
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
        interestRateFive:
          parseFloat(
            document
              .querySelector(DOMstrings.inputRateFive)
              .value.replace(/(?!\.)\D/g, "")
          ) / 100,
        interestRateTen:
          parseFloat(
            document
              .querySelector(DOMstrings.inputRateTen)
              .value.replace(/(?!\.)\D/g, "")
          ) / 100,
        interestRateTwenty:
          parseFloat(
            document
              .querySelector(DOMstrings.inputRateTwenty)
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
        comissionRate:
          parseFloat(
            document
              .querySelector(DOMstrings.inputComissionRate)
              .value.replace(/(?!\.)\D/g, "")
          ) / 100,
        maintenanceRateFive:
          parseFloat(
            document
              .querySelector(DOMstrings.inputMaintenanceRateFive)
              .value.replace(/(?!\.)\D/g, "")
          ) / 100,
        maintenanceRateTen:
          parseFloat(
            document
              .querySelector(DOMstrings.inputMaintenanceRateTen)
              .value.replace(/(?!\.)\D/g, "")
          ) / 100,
        maintenanceRateTwenty:
          parseFloat(
            document
              .querySelector(DOMstrings.inputMaintenanceRateTwenty)
              .value.replace(/(?!\.)\D/g, "")
          ) / 100,
        propertyTaxFive:
          parseFloat(
            document
              .querySelector(DOMstrings.inputPropertyTaxFive)
              .value.replace(/(?!\.)\D/g, "")
          ) / 100,
        propertyTaxTen:
          parseFloat(
            document
              .querySelector(DOMstrings.inputPropertyTaxTen)
              .value.replace(/(?!\.)\D/g, "")
          ) / 100,
        propertyTaxTwenty:
          parseFloat(
            document
              .querySelector(DOMstrings.inputPropertyTaxTwenty)
              .value.replace(/(?!\.)\D/g, "")
          ) / 100,
        houseInsuranceFive:
          parseFloat(
            document
              .querySelector(DOMstrings.inputHouseInsuranceFive)
              .value.replace(/(?!\.)\D/g, "")
          ) / 100,
        houseInsuranceTen:
          parseFloat(
            document
              .querySelector(DOMstrings.inputHouseInsuranceTen)
              .value.replace(/(?!\.)\D/g, "")
          ) / 100,
        houseInsuranceTwenty:
          parseFloat(
            document
              .querySelector(DOMstrings.inputHouseInsuranceTwenty)
              .value.replace(/(?!\.)\D/g, "")
          ) / 100,
        appreciationRateFive:
          parseFloat(
            document
              .querySelector(DOMstrings.inputAppreciationRateFive)
              .value.replace(/(?!\.)\D/g, "")
          ) / 100,
        appreciationRateTen:
          parseFloat(
            document
              .querySelector(DOMstrings.inputAppreciationRateTen)
              .value.replace(/(?!\.)\D/g, "")
          ) / 100,
        appreciationRateTwenty:
          parseFloat(
            document
              .querySelector(DOMstrings.inputAppreciationRateTwenty)
              .value.replace(/(?!\.)\D/g, "")
          ) / 100,
        // Renting Case
        rentValue: parseFloat(
          document
            .querySelector(DOMstrings.inputRentValue)
            .value.replace(/(?!\.)\D/g, "")
        ),
        investmentReturnsFive:
          parseFloat(
            document
              .querySelector(DOMstrings.inputInvestmentReturnsFive)
              .value.replace(/(?!\.)\D/g, "")
          ) / 100,
        investmentReturnsTen:
          parseFloat(
            document
              .querySelector(DOMstrings.inputInvestmentReturnsTen)
              .value.replace(/(?!\.)\D/g, "")
          ) / 100,
        investmentReturnsTwenty:
          parseFloat(
            document
              .querySelector(DOMstrings.inputInvestmentReturnsTwenty)
              .value.replace(/(?!\.)\D/g, "")
          ) / 100,
        cpiRateFive:
          parseFloat(
            document
              .querySelector(DOMstrings.inputCpiRateFive)
              .value.replace(/(?!\.)\D/g, "")
          ) / 100,
        cpiRateTen:
          parseFloat(
            document
              .querySelector(DOMstrings.inputCpiRateTen)
              .value.replace(/(?!\.)\D/g, "")
          ) / 100,
        cpiRateTwenty:
          parseFloat(
            document
              .querySelector(DOMstrings.inputCpiRateTwenty)
              .value.replace(/(?!\.)\D/g, "")
          ) / 100,
        rentersInsuranceFive:
          parseFloat(
            document
              .querySelector(DOMstrings.inputRentersInsuranceFive)
              .value.replace(/(?!\.)\D/g, "")
          ) / 100,
        rentersInsuranceTen:
          parseFloat(
            document
              .querySelector(DOMstrings.inputRentersInsuranceTen)
              .value.replace(/(?!\.)\D/g, "")
          ) / 100,
        rentersInsuranceTwenty:
          parseFloat(
            document
              .querySelector(DOMstrings.inputRentersInsuranceTwenty)
              .value.replace(/(?!\.)\D/g, "")
          ) / 100,
      };
    },

    addElement: function (
      parentId,
      elementTag,
      elementClass,
      html,
      id = false
    ) {
      // Adds an element to the document
      const p = document.getElementById(parentId);
      const newElement = document.createElement(elementTag);
      if (id) {
        newElement.setAttribute("id", elementClass);
      } else {
        newElement.setAttribute("class", elementClass);
      }
      newElement.innerHTML = html;
      p.appendChild(newElement);
    },

    drawHtmlComparison: function (input) {
      let html = `
      <div class="accordion accordion-light amortizationScheduleCard" id="accordion1">
        <div class="card card-default">
          <div class="card-header">
            <h4 class="card-title m-0">
              <a class="accordion-toggle collapsed" data-toggle="collapse" data-parent="#accordion1" 
              href="#collapse0One" aria-expanded="false">
                Comparison - Summary									
              </a>
            </h4>
          </div>
          <div id="collapse0One" class="collapse" data-parent="#accordion1" style="">
              <div class="card-body"> 
                <table class="table table-striped"  style="margin:auto; font-size:90%">
                  <thead>
                      <tr>
                        <th class="ng-binding">After "X" Years</th>
                        <th>Winner</th>
                      </tr>
                  </thead>
                <tbody>`;

      if (input.length > 1) {
        const result = input[1]["comparison"] > 0 ? "Renting by" : "Buying by";
        html += `
        <tr>
          <td>One</td>
          <td>${result} $${Math.abs(input[1]["comparison"])
          .toFixed(0)
          .toLocaleString()
          .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</td>
        </tr>
    `;
      }
      if (input.length > 5) {
        const result = input[5]["comparison"] > 0 ? "Renting by" : "Buying by";
        html += `
        <tr>
          <td>Five</td>
          <td>${result} $${Math.abs(input[5]["comparison"])
          .toFixed(0)
          .toLocaleString()
          .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</td>
        </tr>
         `;
      }

      if (input.length > 10) {
        const result = input[10]["comparison"] > 0 ? "Renting by" : "Buying by";
        html += `
        <tr>
          <td>Ten</td>
          <td>${result} $${Math.abs(input[10]["comparison"])
          .toFixed(0)
          .toLocaleString()
          .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</td>
       </tr>
        `;
      }

      if (input.length > 20) {
        const result = input[20]["comparison"] > 0 ? "Renting by" : "Buying by";
        html += `
        <tr>
          <td>Twenty</td>
          <td>${result} $${Math.abs(input[20]["comparison"])
          .toFixed(0)
          .toLocaleString()
          .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</td>
       </tr>
        `;
      }

      if (input.length === 31) {
        const result = input[30]["comparison"] > 0 ? "Renting by" : "Buying by";
        html += `
        <tr>
          <td>Thirty</td>
          <td>${result} $${Math.abs(input[30]["comparison"])
          .toFixed(0)
          .toLocaleString()
          .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</td>
       </tr>
        `;
      }

      html += `
                              </tbody>
                          </table>
                      </div>
                  </div>
              </div>
          </div>
              `;

      return html;
    },

    drawHtmlRent: function (input) {
      let html = `
        <div class="accordion accordion-light amortizationScheduleCard" id="accordion1">
          <div class="card card-default">
            <div class="card-header">
              <h4 class="card-title m-0">
                <a class="accordion-toggle collapsed" data-toggle="collapse" data-parent="#accordion1" 
                href="#collapse0Two" aria-expanded="false">
                  Renting Case									
                </a>
              </h4>
            </div>
            <div id="collapse0Two" class="collapse" data-parent="#accordion1" style="">
                <div class="card-body"> 
                  <table class="table table-striped"  style="margin:auto; font-size:90%">
                    <thead>
                        <tr>
                          <th class="ng-binding">Year #</th>
                          <th>Cost of Renting</th>
                          <th>Surplus vs Owning</th>
                          <th>Investment Portfolio</th>
                        </tr>
                    </thead>
                  <tbody>`;

      input.forEach(function (entry) {
        html += `
        <tr>
            <td>${entry["year"]}</td>
            <td>$${entry["costOfRenting"]
              .toFixed(0)
              .toLocaleString()
              .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</td> 
            <td>$${entry["surplusVsOwning"]
              .toFixed(0)
              .toLocaleString()
              .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</td>
            <td>$${entry["investmentPortfolio"]
              .toFixed(0)
              .toLocaleString()
              .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</td>
        </tr>   
           
        `;
      });
      html += `
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
                `;

      return html;
    },

    drawHtmlOwn: function (input) {
      let html = `
        <div class="accordion accordion-light amortizationScheduleCard" id="accordion2">
          <div class="card card-default">
            <div class="card-header">
              <h4 class="card-title m-0">
                <a class="accordion-toggle collapsed" data-toggle="collapse" data-parent="#accordion2" 
                href="#collapse0Three" aria-expanded="false">
                  Owning Case									
                </a>
              </h4>
            </div>
            <div id="collapse0Three" class="collapse" data-parent="#accordion2" style="">
                <div class="card-body"> 
                  <table class="table table-striped"  style="margin:auto; font-size:80%;">
                    <thead>
                        <tr>
                          <th class="ng-binding">Year #</th>
                          <th>Mortgage</th>
                          <th>Maintenance</th>
                          <th>Property Tax</th>
                          <th>Insurance</th>
                          <th>Cash Outlay</th>
                          <th>Mortgage Balance</th>
                          <th>House Value</th>
                          <th>Owner's Equity</th>
                        </tr>
                    </thead>
                  <tbody>`;

      input.forEach(function (entry) {
        html += `
        <tr>
            <td>${entry["year"]}</td>
            <td>$${entry["mortgage"]
              .toFixed(0)
              .toLocaleString()
              .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</td> 
            <td>$${entry["maintenance"]
              .toFixed(0)
              .toLocaleString()
              .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</td>
            <td>$${entry["propertyTax"]
              .toFixed(0)
              .toLocaleString()
              .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</td>
              <td>$${entry["insurance"]
                .toFixed(0)
                .toLocaleString()
                .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</td>
              <td>$${entry["annualCashOutlay"]
                .toFixed(0)
                .toLocaleString()
                .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</td>
              <td>$${entry["mortgageBalance"]
                .toFixed(0)
                .toLocaleString()
                .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</td>
              <td>$${entry["houseValue"]
                .toFixed(0)
                .toLocaleString()
                .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</td>
              <td>$${entry["ownerEquity"]
                .toFixed(0)
                .toLocaleString()
                .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</td>
        </tr>   
           
        `;
      });
      html += `
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
                `;

      return html;
    },

    addComparisonChart: function (input) {
      const ctx = document.getElementById("comparison_chart");

      const labels = input.map(function (item, index) {
        return index;
      });

      const data = input.map(function (item) {
        return -Math.round(item.comparison);
      });

      // Interpolating the two data sets;
      let lastItemRent;
      let commonItemRent = true;

      const dataRent = input.map(function (item) {
        lastItemRent = -item.comparison;
        if (item.comparison >= 0) {
          return -Math.round(item.comparison);
        } else {
          if (commonItemRent) {
            commonItemRent = false;
            return Math.round(lastItemRent);
          }
          return null;
        }
      });

      // Interpolating the two data sets;
      let lastItemOwning;
      let commonItemOwning = true;

      const dataBuy = input.map(function (item, index) {
        lastItemOwning = item.comparison;
        if (item.comparison < 0) {
          return -Math.round(item.comparison);
        } else {
          if (index < input.length - 1) {
            if (
              index > 0 &&
              input[index + 1].comparison < 0 &&
              input[index - 1].comparison > 0 &&
              commonItemOwning
            ) {
              commonItemOwning = false;
              return -Math.round(lastItemOwning);
            }
          }

          return null;
        }
      });

      const colors = data.map((value) => (value < 0 ? "#4C89A5" : "#B3C646"));

      // Change size of point for the first positive value (i.e. owning is better)
      let conditionRadius = true;
      const customRadiusArray = data.map(function (item) {
        if (item > 0 && conditionRadius) {
          conditionRadius = false;
          return 9;
        } else {
          return 4;
        }
      });

      // Change color of point for the first positive value (i.e. owning is better)
      let conditionColor = true;
      const customColorsArray = data.map(function (item) {
        if (item > 0 && conditionColor) {
          conditionColor = false;
          return "#B3C646";
        } else {
          return "#333333";
        }
      });

      // Change border width of point for the first positive value (i.e. owning is better)
      let conditionBorderWidth = true;
      const customBorderArray = data.map(function (item) {
        if (item > 0 && conditionBorderWidth) {
          conditionBorderWidth = false;
          return 5;
        } else {
          return 1;
        }
      });

      let conditionBorderColor = true;
      const customBorderColorArray = data.map(function (item) {
        if (item > 0 && conditionBorderColor) {
          conditionBorderColor = false;
          return "#5DA10D";
        } else {
          return "#333333";
        }
      });

      const lineChart = new Chart(ctx, {
        type: "line",
        data: {
          labels: [...labels],
          datasets: [
            {
              label: "Owning Case",
              data: [...dataBuy],
              fill: true,
              borderColor: "#333333",
              backgroundColor: "#E16967",
              pointBackgroundColor: customBorderColorArray,
              pointBorderWidth: customBorderArray,
              pointBorderColor: "#333333",
              radius: customRadiusArray,
              pointRadius: customRadiusArray,
              pointHoverBackgroundColor: "#E16967",
              pointHoverBorderColor: "#1e5398",
            },
            {
              label: "Renting Case",
              data: [...dataRent],
              fill: true,
              borderColor: "#333333",
              backgroundColor: "#3275CD",
              pointBackgroundColor: "#333333",
              pointBorderColor: "#333333",
              pointHoverBackgroundColor: "#3275CD",
              pointHoverBorderColor: "#1e5398",
              radius: customRadiusArray,
              pointRadius: customRadiusArray,
            },
          ],
        },

        options: {
          spanGaps: true,
          responsive: true,
          title: {
            display: true,
            text: "Rent or Buy Comparison",
          },
          scales: {
            xAxes: [
              {
                display: true,
                label: "Year Number",
                scaleLabel: {
                  display: true,
                  labelString: "At end of year",
                },
              },
            ],
            yAxes: [
              {
                display: true,
                scaleLabel: {
                  display: true,
                  // labelString: "Remaining Mortgage Principal",
                },
                ticks: {
                  // Include a dollar sign in the ticks
                  callback: function (value, index, values) {
                    return value >= 0
                      ? "$" +
                          value.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                      : "$ (" +
                          (value * -1)
                            .toFixed(0)
                            .replace(/\B(?=(\d{3})+(?!\d))/g, ",") +
                          ")";
                  },
                },
              },
            ],
          },
          tooltips: {
            enabled: true,
            mode: "index",
            callbacks: {
              label: function (tooltipItems, data) {
                return "$" + tooltipItems.yLabel;
              },
            },
          },
        },
      });
    },

    drawResultText: function (input) {
      html = `
          <div style="width: 100%;">
            
      `;

      let bestYear;
      let positive = false;
      input.forEach(function (data, index) {
        if (data.comparison < 0 && !positive) {
          positive = true;
          bestYear = index;
        }
      });
      let textMessage = `<b style="color:#E16967";>Buying</b> is cheaper if you stay for <span style="color: #5DA10C; font-weight:600";>${bestYear} years</span> or longer. Otherwise, renting is cheaper`;

      if (!bestYear) {
        textMessage = `<span style="color:#3275CD; font-weight:600";>Renting</span> is cheaper in the next ${
          input.length - 1
        } years`;
      }

      html += `
        <p class="card-text">${textMessage}.</p>
      
    </div>
      `;

      return html;
    },
  };
})();

//Global App Controller
const controller = (function (UICtrl) {
  const setupEventListeners = function () {
    const DOM = UICtrl.getDOMstrings();
    console.log({ DOM });
    document.querySelector(DOM.inputBtn).addEventListener("click", ctrlAddItem);
    document.addEventListener("keypress", function (event) {
      if (event.keyCode === 13 || event.which === 13) {
        ctrlAddItem();
      }
    });
  };

  const removeElements = function (list) {
    list.forEach(function (parent) {
      let parentElement = document.getElementById(parent);
      parentElement.innerHTML = "";
    });
  };

  const ctrlAddItem = function () {
    const input = UICtrl.getInput();
    console.log(input);
    const rentCase = Rent.RentingCase(input);
    const ownCase = Owning.OwningCase(input);
    const comparison = Comparison.selling(input);
    const casesArray = [
      "rent_wrapper",
      "buy_wrapper",
      "comparison_wrapper",
      "graph_wrapper",
      "text_result",
    ];
    removeElements(casesArray);

    UICtrl.addElement("graph_wrapper", "canvas", "comparison_chart", "", true);
    UICtrl.addComparisonChart(comparison);

    UICtrl.addElement(
      "text_result",
      "div",
      "card_result",
      UICtrl.drawResultText(comparison)
    );

    UICtrl.addElement(
      "comparison_wrapper",
      "p",
      "comparison_table",
      UICtrl.drawHtmlComparison(comparison)
    );

    UICtrl.addElement(
      "rent_wrapper",
      "p",
      "rent_table",
      UICtrl.drawHtmlRent(rentCase)
    );
    UICtrl.addElement(
      "buy_wrapper",
      "p",
      "buy_table",
      UICtrl.drawHtmlOwn(ownCase)
    );
    document.getElementById("Mortgage-Payment-Graphics").style.display = "";
  };

  return {
    init: function () {
      setupEventListeners();
    },
  };
})(UIController);

controller.init();
