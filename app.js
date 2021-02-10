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
      let yearlyRentValue = input.rentValue * 12 * (1 + input.rentersInsurance);
      const table = years.map(function (factor) {
        return {
          year: factor + currentYear,
          costRent: Rent.yearlyRentCost(yearlyRentValue, input.cpiRate, factor),
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

      const investmentRate = input.investmentReturns;
      const surplus = Rent.surplusOnRent(input);
      const initialPortfolio = Rent.totalCashPurchase(input);

      let balance = initialPortfolio;
      let lastBalance = null;
      const table = years.map(function (factor) {
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
      const currentYear = new Date().getFullYear();
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

      const table = years.map(function (factor) {
        return {
          year: factor + currentYear,
          value:
            Math.round(
              (Owning.houseValue(
                input.houseValue,
                input.appreciationRate,
                factor
              ) -
                mortgage[factor]["mortgageBalance"]) *
                100
            ) / 100,
        };
      });
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
          houseValue: Owning.houseValue(
            input.houseValue,
            input.appreciationRate,
            factor
          ).toFixed(0),
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
                  owner[0]["houseValue"] * input.commissionRate -
                  owner[0]["mortgageBalance"])
              : -(
                  (rent[factor]["investmentPortfolio"] -
                    rent[0]["investmentPortfolio"] -
                    surplus) *
                  investmentTaxRate
                ) +
                rent[factor]["investmentPortfolio"] -
                (owner[factor]["houseValue"] -
                  owner[factor]["houseValue"] * input.commissionRate -
                  owner[factor]["mortgageBalance"]),
          rentOnly:
            factor === 0
              ? rent[0]["investmentPortfolio"]
              : -(
                  rent[factor]["investmentPortfolio"] -
                  rent[0]["investmentPortfolio"] -
                  surplus
                ) *
                  investmentTaxRate +
                rent[factor]["investmentPortfolio"],
          buyOnly:
            factor === 0
              ? -(
                  owner[0]["houseValue"] -
                  owner[0]["houseValue"] * input.commissionRate -
                  owner[0]["mortgageBalance"]
                )
              : -(
                  owner[factor]["houseValue"] -
                  owner[factor]["houseValue"] * input.commissionRate -
                  owner[factor]["mortgageBalance"]
                ),
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
    inputCommissionRate: ".add__commission_rate",
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
        commissionRate:
          parseFloat(
            document
              .querySelector(DOMstrings.inputCommissionRate)
              .value.replace(/(?!\.)\D/g, "")
          ) / 100,
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
        investmentReturns:
          parseFloat(
            document
              .querySelector(DOMstrings.inputInvestmentReturns)
              .value.replace(/(?!\.)\D/g, "")
          ) / 100,
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
                Comparison									
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
                  <table class="table table-striped table-responsive"  style="font-size:90%;">
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

    chartPersonalization: function (
      referenceArray,
      threshold,
      customOutput,
      defaultOutput
    ) {
      let conditionFlag = true;
      const customArray = referenceArray.map(function (item) {
        if (item > threshold && conditionFlag) {
          conditionFlag = false;
          return customOutput;
        } else {
          return defaultOutput;
        }
      });
      return customArray;
    },

    addComparisonChart: function (input) {
      const ctx = document.getElementById("comparison_chart");

      const labels = input.map(function (item, index) {
        return index;
      });

      // Change sign of the data series to plot the graph
      const data = input.map(function (item) {
        return -Math.round(item.comparison);
      });

      // Interpolating the two data sets;
      let commonZeroIndexes = [];
      let dataBuy = [];
      data.forEach(function (item, index) {
        if (item >= 0) {
          dataBuy.push(Math.round(item));
        } else {
          if (data[index - 1] && data[index - 1] >= 0) {
            commonZeroIndexes.push(index);
          }
          dataBuy.push(0);
          if (data[index + 1] && data[index + 1] >= 0) {
            commonZeroIndexes.push(index);
            dataBuy.push(0);
          }
        }
      });

      let dataRent = [];
      data.forEach(function (item, index) {
        if (item < 0) {
          dataRent.push(Math.round(item));
        } else {
          dataRent.push(0);
        }
        if (commonZeroIndexes.indexOf(index) >= 0) {
          dataRent.push(0);
        }
      });

      let dataBuyLine = [];
      let setZeroBuy = true;
      dataBuy.forEach(function (item, index) {
        if (item === 0) {
          if (dataBuy[index - 1] > 0) {
            dataBuyLine.push(0);
            setZeroBuy = true;
          } else {
            dataBuyLine.push(0);
          }
        } else {
          if (setZeroBuy) {
            dataBuyLine[index - 1] = 0;
            setZeroBuy = false;
          }
          dataBuyLine.push(item);
        }
      });

      let dataRentLine = [];
      let setZeroRent = true;
      dataRent.forEach(function (item, index) {
        if (item === 0) {
          if (dataBuy[index - 1] !== null && dataBuy[index - 1] < 0) {
            dataRentLine.push(0);
            setZeroRent = true;
          } else {
            dataRentLine.push(0);
          }
        } else {
          if (setZeroRent) {
            dataBuyLine[index - 1] = 0;
            setZeroRent = false;
          }
          dataRentLine.push(item);
        }
      });

      // Change size of point for the first positive value (i.e. owning is better) and set radius size of all points
      let setRadiusBuy = true;

      // If buying is better only for a certain timeframe but not for the whole length of the schedule
      if (data[data.length - 1] < 0) {
        setRadiusBuy = false;
      }

      const customRadiusArrayBuy = dataBuyLine.map(function (item, index) {
        if (dataBuyLine[index + 1] > 0 && setRadiusBuy) {
          setRadiusBuy = false;
          return 8;
        } else if (item > 0) {
          return 3;
        } else {
          return 0;
        }
      });

      // Radius of rent line
      let setRadiusRent = true;
      const customRadiusArrayRent = dataRentLine.map(function (item, index) {
        if (dataBuyLine[index + 1] < 0 && setRadiusRent) {
          setRadiusRent = false;
          return 8;
        } else if (item < 0) {
          return 2;
        } else {
          return 0;
        }
      });

      // Change border width of point for the first positive value (i.e. owning is better)
      const customBorderArray = this.chartPersonalization(dataBuy, 0, 9, 5);

      // Change color of point for the first positive value (i.e. owning is better)
      let conditionBorderColor = true;
      const customBorderColorArray = dataBuyLine.map(function (item, index) {
        if (dataBuyLine[index + 1] > 0 && conditionBorderColor) {
          conditionBorderColor = false;
          return "#5DA10D";
        } else {
          return "#333333";
        }
      });

      const conditionLineWidthColor = dataBuy.map(function (item) {
        return 0;
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
              borderWidth: conditionLineWidthColor,
              backgroundColor: "#88A3C8",
              radius: 0,
              pointRadius: 0,
            },
            {
              label: "lineBuy",
              data: [...dataBuyLine],
              fill: true,
              borderColor: "#333333",
              borderWidth: 2,
              pointBackgroundColor: customBorderColorArray,
              pointBorderColor: "#333333",
              pointRadius: customRadiusArrayBuy,
            },
            {
              label: "Renting Case",
              data: [...dataRent],
              fill: true,
              borderColor: "#333333",
              borderWidth: conditionLineWidthColor,
              backgroundColor: "#7FA092",
              radius: 0,
              pointRadius: 0,
            },
            {
              label: "lineRent",
              data: [...dataRentLine],
              fill: true,
              borderColor: "#333333",
              borderWidth: 2,
              backgroundColor: "#7FA092",
              pointBackgroundColor: customBorderColorArray,
              pointBorderWidth: customBorderArray,
              radius: customRadiusArrayRent,
              pointRadius: customRadiusArrayRent,
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
          legend: {
            labels: {
              filter: function (item, chart) {
                return !item.text.includes("line");
              },
            },
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
            enabled: false,
            mode: "index",
            // callbacks: {
            //   label: function (tooltipItems, data) {
            //     return "$" + tooltipItems.yLabel;
            //   },
            // },
          },
          hover: {
            mode: null,
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

      let textMessage = `<b style="color:#88A3C8";>Buying</b> is cheaper if you stay for <span style="color: #5DA10C; font-weight:600";>${bestYear} years</span> or longer. Otherwise, renting is cheaper`;

      if (!bestYear || input[input.length - 1]["comparison"] > 0) {
        textMessage = `<span style="color:#7FA092; font-weight:600";>Renting</span> is cheaper in the next ${
          input.length - 1
        } years`;
      }

      html += `
        <p class="card-text">${textMessage}.</p>
      
    </div>
      `;

      return html;
    },

    inputValidation: function (object) {
      //Get array with the name of all classes
      let classNames = Object.values(object).slice(1);

      // Remove radio buttons from array
      radiosIndex = classNames.indexOf("input[name=gridRadios]:checked");
      classNames.splice(radiosIndex, 1);

      // Remove 'is-invalid' for second run of results
      classNames.forEach(function (item) {
        item = item.replace(".", "");
        if (document.getElementById(item).classList.length > 2) {
          document.getElementById(item).classList.remove("is-invalid");
        }
      });

      // Add 'is-invalid' class if input is empty
      let emptyInputs = [];
      classNames.forEach(function (name) {
        if (document.querySelector(name).value === "") {
          emptyInputs.push(name);
          document.querySelector(name).className += " is-invalid";
        }
      });

      // Focus on first empty input field
      if (emptyInputs.length > 0) {
        document.querySelector(emptyInputs[emptyInputs.length - 1]).focus();

        const errorMessage =
          "<p class='LTV-Calc-Results'>Your numbers are not valid. Please check your inputs and try again.</p>";
        UIController.addElement(
          "emptyInputsMsg",
          "div",
          "missingInputs",
          errorMessage
        );

        return false;
      } else {
        return true;
      }
    },

    listOfLabels: function () {
      const references = {
        add__amort_period: "Amortization Period",
        add__appreciation_rate: "House Appreciation Rate",
        add__cpi_rate: "CPI Rate Increase",
        add__house_insurance: "Insurance",
        add__house_value: "House Purchase Price",
        add__interest_rate: "Interest Rate",
        add__investment_returns: "Investment Returns",
        add__maintenance_rate: "Maintenance",
        add__property_tax: "Property Tax",
        add__renters_insurance: "Renters Insurance",
      };

      return references;
    },
  };
})();

//Global App Controller
const controller = (function (UICtrl) {
  const setupEventListeners = function () {
    const DOM = UICtrl.getDOMstrings();

    document.querySelector(DOM.inputBtn).addEventListener("click", ctrlAddItem);

    document.querySelectorAll("input").forEach((item) => {
      item.addEventListener("focusout", (event) => {
        item.value = parseFloat(
          item.value.replace(/(?!\.)\D/g, "")
        ).toLocaleString();
        if (isNaN(parseFloat(item.value))) {
          item.value = "";
        }
      });
    });

    document.addEventListener("keypress", function (event) {
      if (event.keyCode === 13 || event.which === 13) {
        ctrlAddItem();
      }
    });
  };

  const eraseContent = function (list) {
    list.forEach(function (parent) {
      let parentElement = document.getElementById(parent);
      parentElement.innerHTML = "";
    });
  };

  const ctrlAddItem = function () {
    const DOMstrings = UICtrl.getDOMstrings();

    eraseContent([
      "rent_wrapper",
      "buy_wrapper",
      "comparison_wrapper",
      "graph_wrapper",
      "text_result",
      "emptyInputsMsg",
    ]);

    const validateInputs = UICtrl.inputValidation(DOMstrings);

    if (!validateInputs) {
      return false;
    }

    const input = UICtrl.getInput();
    const rentCase = Rent.RentingCase(input);
    const ownCase = Owning.OwningCase(input);
    const comparison = Comparison.selling(input);

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
  };

  return {
    init: function () {
      setupEventListeners();
    },
  };
})(UIController);

controller.init();
