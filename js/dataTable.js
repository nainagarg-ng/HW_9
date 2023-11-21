class DataTable {

    // constructor method to initialize Timeline object
    constructor(parentElement, covidData, usaData) {
        this.parentElement = parentElement;
        this.covidData = covidData;
        this.usaData = usaData;
        this.displayData = [];

        // parse date method
        this.parseDate = d3.timeParse("%m/%d/%Y");

        this.initTable()
    }

    initTable() {
        let tableObject = this
        tableObject.table = d3.select(`#${tableObject.parentElement}`)
            .append("table")
            .attr("class", "table table-hover")

        // append table head
        tableObject.thead = tableObject.table.append("thead")
        tableObject.thead.html(
            `<tr class="text-uppercase" style="font-size: 0.70rem; background: lightcoral">
                <th class="align-middle" scope="col">State</th>
                <th class="align-middle" scope="col">Population</th>
                <th class="align-middle" scope="col">New Cases (Absolute)</th>
                <th class="align-middle" scope="col">New Cases (Relative)</th>
                <th class="align-middle" scope="col">New Deaths (Absolute)</th>
                <th class="align-middle" scope="col">New Deaths (Relative)</th>
            </tr>`
        )

        // append table body
        tableObject.tbody = tableObject.table.append("tbody")

        // wrangleData
        tableObject.wrangleData()
    }

    wrangleData() {
        let vis = this

        // check out the data
        // console.log(vis.covidData)
        // console.log(vis.usaData)

        // first, filter according to selectedTimeRange, init empty array
        let filteredData = [];

        // if there is a region selected
        if (selectedTimeRange.length !== 0) {
            //console.log('region selected', vis.selectedTimeRange, vis.selectedTimeRange[0].getTime() )

            // iterate over all rows the csv (dataFill)
            vis.covidData.forEach(row => {
                // and push rows with proper dates into filteredData
                if (selectedTimeRange[0].getTime() <= vis.parseDate(row.submission_date).getTime() && vis.parseDate(row.submission_date).getTime() <= selectedTimeRange[1].getTime()) {
                    filteredData.push(row);
                }
            });
        } else {
            filteredData = vis.covidData;
        }

        // prepare covid data by grouping all rows by state
        let covidDataByState = Array.from(d3.group(filteredData, d => d.state), ([key, value]) => ({key, value}))

        // have a look
        // console.log(covidDataByState)

        // init final data structure in which both data sets will be merged into
        vis.stateInfo = []

        // merge
        covidDataByState.forEach(state => {

            // get full state name
            let stateName = nameConverter.getFullName(state.key)

            // init counters
            let newCasesSum = 0;
            let newDeathsSum = 0;
            let population = 0;

            // look up population for the state in the census data set
            vis.usaData.forEach(row => {
                if (row.state === stateName) {
                    population += +row["2020"].replaceAll(',', '');
                }
            })

            // calculate new cases by summing up all the entries for each state
            state.value.forEach(entry => {
                newCasesSum += +entry['new_case'];
                newDeathsSum += +entry['new_death'];
            });

            // populate the final data structure
            vis.stateInfo.push(
                {
                    state: stateName,
                    population: population,
                    absCases: newCasesSum,
                    absDeaths: newDeathsSum,
                    relCases: (newCasesSum / population * 100),
                    relDeaths: (newDeathsSum / population * 100)
                }
            )

            // sort in alphabetical order by state name
            vis.stateInfo.sort(function (a, b) {
                return a.state.localeCompare(b.state);
            });

            // // sort by population
            // vis.stateInfo.sort(function (a, b) {
            //     return b.population - a.population;
            // });
        })

        // console.log('final data structure for myDataTable', vis.stateInfo);

        vis.updateTable()

    }

    updateTable() {
        let tableObject = this;

        // reset tbody
        tableObject.tbody.html('')

        // loop over all states
        tableObject.stateInfo.forEach(state => {
            let row = tableObject.tbody.append("tr")
            row.html(
                `<td style="font-size: 0.85rem; font-weight: bold">${state.state}</td>
                <td>${(state.population).toLocaleString()}</td>
                <td>${(state.absCases).toLocaleString()}</td>
                <td>${(state.absDeaths).toLocaleString()}</td>
                <td>${(state.relCases).toFixed(2) + "%"}</td>
                <td>${(state.relDeaths).toFixed(2) + "%"}</td>`
            )
            row.on('mouseover', function () {
                // console.log(' you hovered over a row - the selected state is', state.state)
                selectedState = state.state;
                myBrushVis.wrangleDataResponsive();
            })
        })
    }
}