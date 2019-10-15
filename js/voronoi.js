Array.prototype.sum = function() {
    return this.reduce((a, b) => a + b, 0);
};

Array.prototype.toHex = function() {
    return this.map(function (byte) {
        return ('0' + (Math.round(byte) & 0xFF).toString(16)).slice(-2);
    }).join('');
};

Array.prototype.diff = function(arr) {
    if (this.length != arr.length) {
        throw "Arrays are different length";
    }
    const diff = this.map((el, i) => {
        return Math.abs(el - arr[i]);
    });
    return diff.sum();
}

String.prototype.hexToRgb = function() {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(this);
    return result ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
    ] : [0, 0, 0];
};

class VoronoiMask {
    constructor(el, opts) {
        this.el = el;
        this.baseSrc = opts["base"];
        this.revealSrc = opts["reveal"];
        this.maskSrc = opts["mask"];
        this.regions = opts["regions"];
        this.numVertices = opts["vertices"] || 100;
        this.threshold = opts["mask-threshold"] || 10;
        if (
            !this.baseSrc || 
            !this.revealSrc || 
            !this.maskSrc || 
            !this.regions
        ) {
            throw "Missing parameter(s) for element";
        }
    }

    _renderMask() {
        return new Promise((resolve, reject) => {
            const _this = this;
            const maskImg = new Image();
            this.el.append("<canvas class='mask'></canvas>");
            this.canvas = this.el.find(".mask");
            maskImg.src = this.maskSrc;
            maskImg.setAttribute('crossOrigin', '');
            maskImg.onload = function() {
                _this.width = this.width;
                _this.height = this.height;
                _this.canvas[0].width = this.width;
                _this.canvas[0].height = this.height;
                _this.canvas[0].getContext('2d').drawImage(this, 0, 0, _this.width, _this.height);
                return resolve();
            };
            maskImg.onerror = function() {
                return reject("Error loading mask");
            }
        });
    }

    _renderImages() {
        this.svg.selectAll("image").data([
                {
                    src: this.baseSrc,
                    id: 'base'
                },
                {
                    src: this.revealSrc,
                    id: 'reveal'
                }
            ])
            .enter()
            .append("svg:image")
            .attr("x", 0)
            .attr("y", 0)
            .attr("clip-path", d => d.id == "reveal" ? "url(#mask)" : "")
            .attr("id", d => d.id)
            .attr("xlink:href", d => d.src);
    }

    _renderSvg() {
        this.svg = d3.select(`#${this.el.attr("id")}`)
            .append("svg");

        this.svg.selectAll("clipPath").data(["mask"])
            .enter()
            .append("clipPath")
            .attr("id", d => d);
    }

    _renderShapes() {
        const vertices = d3.range(this.numVertices).map(d => [Math.random() * this.width, Math.random() * this.height]);
        const voronoi = d3.voronoi().extent([
            [0, 0],
            [this.width, this.height]
        ]);
        
        this.shapes = this.svg.append("g")
            .attr("id", "shapes")
            .attr("opacity", 0)
            .selectAll("polygon")
            .data(voronoi.polygons(vertices))
            .enter()
            .append("polygon")
            .attr("id", (d, i) => "area" + i)
            .attr("points", d => { 
                return d.join(" ");
            });
        
        this.vertexData = [];
        vertices.forEach((loc, i) => {
            const vertex = {};
            vertex.id = "area" + i;
            vertex.loc = loc;
            vertex.rgb = Array.from(this.canvas[0].getContext('2d').getImageData(loc[0], loc[1], 1, 1).data).slice(0, 3);
            vertex.hex = "#" + vertex.rgb.toHex();
            const points = Array.from(this.svg.select("#area" + i).node().points).map((pt, i) => {
                return [pt.x, pt.y];
            });
            vertex.size = d3.polygonArea(points);
            this.vertexData.push(vertex);
        });
    }

    _assignRegions() {
        for (var i = 0; i < this.vertexData.length; i++) {
            for (var n = 0; n < this.regions.length; n++) {
                const region = this.regions[n];

                if (!region.vertices) region.vertices = [];
                if (!region.size) region.size = 0;
                if (!region.rgb) region.rgb = region.color.hexToRgb();

                const vertex = this.vertexData[i];
                const diff = vertex.rgb.diff(region.rgb);
                if (this.threshold > diff) {
                    region.vertices.push(vertex);
                    region.size += vertex.size;
                    break;
                }
            }
        }
    }

    _clearClipPath(clipPath) {
        this.svg.select("clipPath#mask")
            .selectAll("." + clipPath)
            .remove();
    }

    _addPolygonToClipPath(polygon, clipPath) {
        const points = this.svg.select("#" + polygon)
            .attr("points");
        
        this.svg.select("clipPath")
            .append("polygon")
            .attr("class", clipPath)
            .attr("points", points);
    }

    showFullRegion(regionId) {
        const regions = this.regions.filter(curRegion => curRegion.id == regionId);
        if (!regions.length) {
            throw "No region found";
        }
        const vertices = regions[0].vertices.map(vertex => vertex.id);
        
        this._clearClipPath(regionId);
        vertices.forEach(vertexId => {
            this._addPolygonToClipPath(vertexId, regionId);
        });
    }

    render() {
        return new Promise((resolve, reject) => {
            this._renderSvg();
            this._renderImages();
            this._renderMask()
            .then(() => {
                this._renderShapes();
                this._assignRegions();
                this.svg.attr("viewbox", `0 0 ${this.width} ${this.height}`);
                this.svg.attr("width", this.width);
                this.svg.attr("height", this.height);
                return resolve();
            })
            .catch(err => {
                return reject(err);
            });
        });
    }
};