# Demographic Dynamics of Europe (1960–2024)

*Scientific and Large Data Visualization*

## Overview

The project is an interactive visualization of demographic change across
European countries between 1960 and 2024. Rather than displaying absolute
population counts, which largely reflect the size of a country, it presents the
underlying demographic processes: birth rates, death rates, natural population
change, and net migration. This focus on the rate and direction of change allows
countries of very different sizes to be compared on the same terms.

The central distinction the application makes visible is the source of
population growth or decline. Population is shaped by two factors: natural change
(births minus deaths) and migration (people entering and leaving). A country may
record more deaths than births and still grow if immigration is sufficient. The
visualization is designed to make this distinction immediately legible.

## Data

### Demographic data

The demographic data is drawn from Eurostat's `demo_gind` dataset (*Population
change — Demographic balance and crude rates at national level*), which provides
yearly indicators for approximately 40 European countries from 1960 onward. The
relevant indicators are population on 1 January, live births, deaths, and the
crude rates derived from them. The two indicators that drive the analytical part
of the application are the **natural change rate** and the **net migration
rate**; examining them jointly distinguishes the demographic regimes described
below.

### Geographic data

Country boundaries are taken from Eurostat's GISCO service (administrative units,
level 0), distributed as TopoJSON. GISCO was selected over the more common
`world-atlas` data because it uses the same country codes as the demographic
dataset (for example, Greece as `EL` and the United Kingdom as `UK`). The two
datasets therefore join directly on a shared key, with no code remapping
required.

### Preprocessing

A Python script (using Pandas) retrieves the data, removes EU-wide aggregates,
strips Eurostat status flags and missing-value markers, and reshapes the
wide-format source into a single tidy CSV. The result is one data file consumed
by the frontend, with one row per country, indicator, and year.

## Coordinated Multiple Views

The application is built on the Coordinated Multiple Views (CMV) pattern, a
standard approach in scientific visualization in which several linked views
present different facets of the same data. No view holds its own state; all of
them read from a single shared application state (the selected indicator, year,
and country), and any interaction updates every view at once. This guarantees
that the map, the chart, and the legend always describe the same selection.

## Components

### Choropleth map

The primary spatial view, rendered with `d3.geoPath()`. A Europe-centered
projection is used (`d3.geoNaturalEarth1()` or a conic conformal projection)
rather than Mercator, which distorts area at northern latitudes and would
misrepresent the Nordic countries.

Each country is filled according to the value of the selected indicator in the
selected year. Hovering a country opens a tooltip with its name, the year, and
the indicator value; clicking it sets the active country and updates the other
views. The selected country is highlighted by its outline rather than by a
change of fill, since the fill already encodes the indicator value.

### Time-series chart

A line chart, rendered with `d3.line()`, that plots the selected indicator for
the selected country across the full 1960–2024 range. Where the map gives a
spatial snapshot of a single year, the chart gives the temporal dimension,
making longer demographic transitions such as declining fertility or population
ageing observable across decades.

### Indicator selector

A control (radio buttons or a dropdown) for choosing the active indicator.
Changing it recolors the map, redraws the chart, and swaps the legend, including
a switch between sequential and diverging color scales where appropriate.

### Year slider

A range input spanning 1960–2024. Moving it updates the year-dependent views in
real time: the map colors, the tooltip values, and the statistics panel.

### Country search

A text input with country-name suggestions, offered as an alternative to
clicking the map (useful for smaller countries). A selection sets the active
country through the same update path as a map click.

### Statistics panel

A compact summary for the selected country and year: the indicator value, its
rank or percentile relative to the other European countries, and the
year-over-year direction of change.

## Color scales

The choice of color scale follows the nature of each indicator. Birth and death
rates are one-directional and use a sequential scale. Natural change and net
migration can be positive or negative, and the sign carries the essential
information; these use a diverging scale centered on zero, with growth and
decline shown in contrasting colors. The legend updates with the selected
indicator to reflect the corresponding scheme, range, and unit.

## Demographic regimes

Combining natural change with net migration sorts countries into a small number
of recognizable patterns:

| Country | Natural change | Migration | Interpretation |
|---------|----------------|-----------|----------------|
| Germany | negative | positive | population sustained by immigration |
| Poland | negative | slightly positive | population stagnation |
| Sweden | positive | positive | growth driven by both factors |

These patterns are difficult to identify from absolute population figures, which
is the reason the application works with rates.

## Scalability considerations

The dataset is modest in size (on the order of a few thousand observations), but
the project illustrates where common visualization techniques scale and where
they do not. For roughly 40 countries, D3 with SVG is sufficient: each country
is a single path, and per-element interactivity is straightforward. At regional
resolution (NUTS-2 or NUTS-3), the geometry grows to thousands of polygons. SVG
creates one DOM node per element and becomes inefficient at that scale, at which
point Canvas or WebGL is the appropriate choice, with manual hit-testing for
interaction.

## Technology stack

| Layer | Technology |
|-------|------------|
| Frontend | HTML, CSS, JavaScript |
| Visualization | D3.js v7 |
| Data processing | Python, Pandas |
| Geographic data | TopoJSON (Eurostat GISCO) |
| Development environment | PyCharm |
