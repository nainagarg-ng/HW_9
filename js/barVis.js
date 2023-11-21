/* * * * * * * * * * * * * *
*      class BarVis        *
* * * * * * * * * * * * * */


class BarVis {

    constructor(parentElement, covidData, usaData, descending = true) {
        this.parentElement = parentElement;
        this.covidData = covidData;
        this.usaData = usaData;

        this.descending = descending;

        // parse date method
        this.parseDate = d3.timeParse("%m/%d/%Y");

        this.initVis()
    }

    initVis() {
        let vis = this;

        vis.margin = {top: 25, right: 30, bottom: 40, left: 45};
        vis.width = document.getElementById(vis.parentElement).getBoundingClientRect().width - vis.margin.left - vis.margin.right;
        vis.height = document.getElementById(vis.parentElement).getBoundingClientRect().height - vis.margin.top - vis.margin.bottom;

        // init drawing area
        vis.svg = d3.select("#" + vis.parentElement).append("svg")
            .attr("width", vis.width + vis.margin.left + vis.margin.right)
            .attr("height", vis.height + vis.margin.top + vis.margin.bottom)
            .append('g')
            .attr('transform', `translate (${vis.margin.left}, ${vis.margin.top})`);

        // TODO
        // init scales
        vis.x = d3.scaleBand()
            .range([0, vis.width])
            .padding(0.1);

        vis.y = d3.scaleLinear()
            .range([vis.height, 0]);

        // color scale
        vis.colorScale = d3.scaleLinear()
            .range(["#FFFFFF", "#136D70"]);

        // init axes
        vis.xAxis = d3.axisBottom(vis.x);
        vis.yAxis = d3.axisLeft(vis.y);

        // create axis groups
        vis.xAxisGroup = vis.svg.append("g")
            .attr("class", "axis x-axis")
            .attr("transform", `translate(0, ${vis.height})`);

        vis.yAxisGroup = vis.svg.append("g")
            .attr("class", "axis y-axis");

        // group bars
        vis.barsGroup = vis.svg.append("g")

        // tooltip
        vis.tooltip = d3.select("body").append('div')
            .attr('class', "tooltip")
            .attr('id', 'barTooltip')

        vis.wrangleData();
    }

    wrangleData() {
        let vis = this
        // Pulling this straight from dataTable.js
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
            vis.stateInfo.push({
                state: stateName,
                population: population,
                absCases: newCasesSum,
                absDeaths: newDeathsSum,
                relCases: (newCasesSum / population * 100),
                relDeaths: (newDeathsSum / population * 100)
            })
        })
        // TODO: Sort and then filter by top 10
        // maybe a boolean in the constructor could come in handy ?

        if (vis.descending) {
            vis.title = "10 Worst States"
            vis.stateInfo.sort((a, b) => {
                return b[selectedCategory] - a[selectedCategory]
            })
        } else {
            vis.title = "10 Best States"
            vis.stateInfo.sort((a, b) => {
                return a[selectedCategory] - b[selectedCategory]
            })
        }
        // console.log('final data structure: stateInfo', vis.stateInfo);

        vis.topTenData = vis.stateInfo.slice(0, 10)
        // console.log('final data structure; topTenData', vis.topTenData);

        // add title
        vis.svg.append('g')
            .attr('class', 'title bar-title')
            .append('text')
            .text(vis.title)
            .attr('transform', `translate(${vis.width / 2}, 0)`)
            .attr("font-size", "15px")
            .attr("font-weight", "bold")
            .attr('text-anchor', 'middle');

        vis.updateVis()
    }

    updateVis() {
        let vis = this;
        // console.log('here')

        // update domains
        vis.x.domain(vis.topTenData.map(d => d.state));
        vis.y.domain([0, d3.max(vis.topTenData, d => d[selectedCategory])]);

        // update color scale
        vis.colorScale.domain([0, d3.max(vis.stateInfo, d => d[selectedCategory])])

        // update axes
        vis.xAxisGroup
            .transition().duration(400)
            .call(vis.xAxis)
            .selectAll("text")
            .attr("font-size", "8px")
            .attr("transform", "rotate(15)")
            .style("text-anchor", "start");

        vis.yAxisGroup
            .transition().duration(400)
            .call(vis.yAxis);

        // draw the bars
        vis.bars = vis.barsGroup.selectAll("rect")
            .data(vis.topTenData, d => d.state); // provide key function by state

        vis.bars.enter()
            .append('rect')
            .merge(vis.bars)
            .attr("x", 0)
            .attr("class", d => `bar ${d.state.replaceAll(' ', '-')}`)
            .attr("y", vis.height)
            .attr("width", vis.x.bandwidth())
            .attr("height", 0)
            .attr("fill", d => vis.colorScale(d[selectedCategory]))

            // bar mouseover
            .on("mouseover", function (event, d) {

                // tooltip for bars
                vis.tooltip
                    .style("opacity", 0.9)
                    .style("left", 5+event.pageX + "px")
                    .style("top", 5+event.pageY + "px")
                    .html(`
                        <div style="border: thin solid grey; border-radius: 5px; background: lightcoral; padding: 10px">
                            <h3>${d.state}</h3>
                            <h4><strong>Population:</strong> ${d.population.toLocaleString()}</h4>
                            <h4><strong>Cases (Absolute):</strong> ${d.absCases.toLocaleString()}</h4>
                            <h4><strong>Death (Absolute):</strong> ${d.absDeaths.toLocaleString()}</h4>
                            <h4><strong>Cases (Relative to Population):</strong> ${d.relCases.toFixed(2)+"%"}</h4>
                            <h4><strong>Death (Relative to Population):</strong> ${d.relDeaths.toFixed(2)+"%"}</h4>
                        </div>`);

                // reset the color of the bars
                d3.select(this)
                    .style("fill", "lightcoral")
                    .style("stroke", "darkred")
                    .style("stroke-width", "3px")

                // reset the color of the map tile
                d3.selectAll(`.${d.state.replaceAll(' ', '-')}`)
                    .style("fill", "lightcoral")
                    .style("stroke", "darkred")
                    .style("stroke-width", "3px")
            })

            // map mouseout
            .on("mouseout", function (event, d) {

                // tooltip for bars
                vis.tooltip
                    .style("opacity", 0)
                    .style("left", 0)
                    .style("top", 0)
                    .html('');

                // reset the color of the bars
                d3.select(this)
                    .style("fill", d => vis.colorScale(d[selectedCategory]))
                    .style("stroke", "none")
                    .style("stroke-width", "0px")

                // reset the color of the map tile
                d3.select(`.${d.state.replaceAll(' ', '-')}`)
                    .style("fill", d => vis.colorScale(d[selectedCategory]))
                    .style("stroke", "black")
                    .style("stroke-width", "1px")
            })
            .transition()
            .delay((d, i) => i * 10)
            .ease(d3.easeLinear)
            .duration(400)
            .attr("x", d => vis.x(d.state))
            .attr("y", d => vis.y(d[selectedCategory]))
            .attr("height", d => vis.height - vis.y(d[selectedCategory]))

        vis.bars.exit().remove();
    }
}