/* * * * * * * * * * * * * *
*          MapVis          *
* * * * * * * * * * * * * */


class MapVis {

    constructor(parentElement, dataTopographic, covidData, usaData) {
        this.parentElement = parentElement;
        this.dataTopographic = dataTopographic;
        this.covidData = covidData;
        this.usaData = usaData;

        this.displayData = [];

        // parse date method
        this.parseDate = d3.timeParse("%m/%d/%Y");

        this.initVis()
    }

    initVis() {
        let vis = this;

        vis.margin = {top: 10, right: 10, bottom: 10, left: 10};
        vis.width = document.getElementById(vis.parentElement).getBoundingClientRect().width - vis.margin.left - vis.margin.right;
        vis.height = document.getElementById(vis.parentElement).getBoundingClientRect().height - vis.margin.top - vis.margin.bottom;

        // init drawing area
        vis.svg = d3.select("#" + vis.parentElement).append("svg")
            .attr("width", vis.width)
            .attr("height", vis.height)
            .attr('transform', `translate (${vis.margin.left}, ${vis.margin.top})`);

        // projected map to a specific viewpoint
        vis.viewpoint = {'width': 975, 'height': 610};
        vis.zoom = vis.width / vis.viewpoint.width;

        // adjust map position
        vis.map = vis.svg.append("g") // group will contain all state paths
            .attr("class", "states")
            .attr('transform', `scale(${vis.zoom} ${vis.zoom})`);

        // init path generator
        vis.path = d3.geoPath();

        // Convert TopoJSON to GeoJSON (target object = 'states')
        vis.data = topojson.feature(vis.dataTopographic, vis.dataTopographic.objects.states).features;

        // bind data
        vis.states = vis.map.selectAll(".state")
            .data(vis.data)
            .enter()
            .append("path") // drawing states
            .attr("id", function (d) {})
            .attr("class", d => `state ${d.properties.name.replaceAll(' ', '-')}`)
            .attr("d", vis.path)
            .attr("stroke", "black")
            .attr("fill", "transparent")
            .attr("stroke-width", 1);

        // color scale
        vis.colorScale = d3.scaleLinear()
            .range(["#FFFFFF", "#136D70"])

        // legend
        vis.legend = vis.svg.append("g")
            .attr("class", "axis axis--legend");

        vis.linearGradient = vis.legend.append("defs")
            .append("linearGradient")
            .attr("id", "linear-gradient")
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "100%")
            .attr("y2", "0%");

        // Set the color for the start (0%)
        vis.linearGradient.append('stop')
            .attr("offset", "0%")
            .style("stop-color", "#ffffff")
            .style("stop-opacity", "1")

        vis.linearGradient.append('stop')
            .attr("offset", "100%")
            .style("stop-color", "#136D70")
            .style("stop-opacity", "1")

        vis.legend.append("rect")
            .attr("width", vis.width / 1.25)
            .attr("height", vis.height / 20)
            .attr("x", 60)
            .attr("y", vis.height - 48)
            .attr("fill", "url(#linear-gradient)"); //  need to reference the exact gradient ID here

        vis.legendScale = d3.scaleLinear()
            .range([0, vis.width / 1.25]);

        vis.legendAxis = d3.axisBottom()
            .scale(vis.legendScale)
            .ticks(7);

        vis.legendAxisGroup = vis.legend.append("g")
            .attr("transform", `translate(60, ${vis.height - 20})`)
            .call(vis.legendAxis);

        // tooltip
        vis.tooltip = d3.select("body").append('div')
            .attr('class', "tooltip")
            .attr('id', 'mapTooltip')

        vis.wrangleData();
    }

    wrangleData() {
        let vis = this

        // check out the data
        // console.log("covid data", vis.covidData)
        // console.log("usa data", vis.usaData)

        // first, filter according to selectedTimeRange, init empty array
        let filteredData = [];

        // if there is a region selected
        if (selectedTimeRange.length !== 0) {
            // console.log('region selected', vis.selectedTimeRange, vis.selectedTimeRange[0].getTime())

            // iterate over all rows of the csv (dataFill)
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
        // console.log("covid data by state", covidDataByState)

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
        // console.log('final data structure for VisMap', vis.stateInfo);

        vis.updateVis()

    }

    updateVis() {
        let vis = this;

        // color the map
        vis.colorScale.domain([0, d3.max(vis.stateInfo, d => d[selectedCategory])])

        // update the legend
        vis.legendScale.domain([0, d3.max(vis.stateInfo, d => d[selectedCategory])])

        vis.legendAxis.scale(vis.legendScale)
            .ticks(7)
            .tickFormat(d3.format(".2s"));

        vis.legendAxisGroup
            .transition()
            .duration(400)
            .call(vis.legendAxis);

        // Add & update chart title
        vis.svg.selectAll(".title").remove();

        vis.title = vis.svg.append('g')
            .attr('class', 'title')
            .attr('id', 'map-title')
            .append('text')
            .text("COVID-19 " + selectedCategoryText)
            .attr('transform', `translate(${vis.width / 2}, 20)`)
            .attr('text-anchor', 'middle')
            .attr("font-size", "20px")
            .attr("font-weight", "bold");

        // update map
        vis.states
            .attr("fill", d => {
                let stateName = d.properties.name;
                let color = " ";
                vis.stateInfo.forEach(state => {
                    if (stateName === state.state) {
                        color = vis.colorScale(state[selectedCategory]);
                    }
                })
                return color
            })

            // map mouseover
            .on("mouseover", function (event, state) {
                let key = state.properties.name
                let tooltipData = {}
                vis.stateInfo.forEach(state => {
                    if (key === state.state) {
                        tooltipData = state
                    }
                })

                // tooltip
                vis.tooltip
                    .style("opacity", 1)
                    .style("left", event.pageX + 20 + "px")
                    .style("top", event.pageY + "px")
                    .html(`
                        <div style="border: thin solid grey; border-radius: 5px; background: lightcoral; padding: 10px">
                            <h3>${state.properties.name}</h3>
                            <h4><strong>Population:</strong> ${tooltipData.population.toLocaleString()}</h4>
                             <h4><strong>Cases (Absolute):</strong> ${tooltipData.absCases.toLocaleString()}</h4>
                             <h4><strong>Death (Absolute):</strong> ${tooltipData.absDeaths.toLocaleString()}</h4>
                             <h4><strong>Cases (Relative to Population):</strong> ${tooltipData.relCases.toFixed(2) + "%"}</h4>
                             <h4><strong>Death (Relative to Population):</strong> ${tooltipData.relDeaths.toFixed(2) + "%"}</h4>
                             </div>`);

                // reset the color of the map tile
                d3.select(this)
                    .attr("fill", "lightcoral")
                    .style("stroke", "darkred")
                    .style("stroke-width", "3px")

                // reset the color of the bars
                d3.select(`.bar.${state.properties.name}`)
                    .style("fill", "lightcoral")
                    .style("stroke", "darkred")
                    .style("stroke-width", "3px")
            })

            // map mouseout
            .on("mouseout", function (event, state) {

                // tooltip
                vis.tooltip
                    .style("opacity", 0)
                    .style("left", 0)
                    .style("top", 0)
                    .html('');

                // reset the color of the map tile
                d3.select(this)
                    .attr("fill", d => {
                        let stateName = d.properties.name;
                        let color = " ";
                        vis.stateInfo.forEach(state => {
                            if (stateName === state.state) {
                                color = vis.colorScale(state[selectedCategory]);
                            }
                        })
                        return color
                    })
                    .style("stroke", "black")
                    .style("stroke-width", "1px")

                // reset the color of the bar
                d3.select(`.bar.${state.properties.name}`)
                    .style("fill", state => vis.colorScale(state[selectedCategory]))
                    .style("stroke", "none")
                    .style("stroke-width", "0px")
            })
        // console.log("Map");

    }
}