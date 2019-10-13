Array.prototype.sum = function() {
    return this.reduce((a, b) => a + b, 0);
};

Array.prototype.toHex = function() {
    return this.map(function (byte) {
        return ('0' + (byte & 0xFF).toString(16)).slice(-2);
    }).join('');
}

class Voronoi {
    constructor(el) {
        this.el = el;
        this.id = this.el.attr("id");
        this.baseSrc = this.el.data("base");
        this.revealSrc = this.el.data("reveal");
        this.maskSrc = this.el.data("mask");
        this.numVertices = this.el.data("vertices") || 100;
        if (
            !this.baseSrc || 
            !this.revealSrc || 
            !this.maskSrc
        ) {
            throw "Missing image(s) for Element " + this.id;
        }
        this.render();
    }

    _renderMask() {
        return new Promise((resolve, reject) => {
            const _this = this;
            this.maskImg = new Image();
            this.el.append("<canvas class='mask'></canvas>");
            this.canvas = this.el.find(".mask");
            this.maskImg.src = this.maskSrc;
            this.maskImg.setAttribute('crossOrigin', '');
            this.maskImg.onload = function() {
                _this.width = this.width;
                _this.height = this.height;
                _this.canvas[0].width = this.width;
                _this.canvas[0].height = this.height;
                _this.canvas[0].getContext('2d').drawImage(this, 0, 0, _this.width, _this.height);
                return resolve();
            };
            this.maskImg.onerror = function() {
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
            // .attr('width', 20)
            // .attr('height', 24)
            .attr("xlink:href", d => d.src);
    }

    _renderSvg() {
        this.svg = d3.select(`#${this.id}`)
            .append("svg");

        this.clipPath = this.svg.selectAll("clipPath").data([
                {
                    id: "mask"
                }
            ])
            .enter()
            .append("clipPath")
            .attr("id" , d => d.id);
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
            .selectAll("path")
            .data(voronoi.polygons(vertices))
            .enter()
            .append("path")
            .attr("id", (d, i) => i)
            .attr("d", d => { 
                return "M" + d.join("L") + "Z";
            });
        
        this.vertexData = [];
        const regionColors = {};
        vertices.forEach((loc, i) => {
            const vertex = {};
            vertex.loc = loc;
            vertex.mask = Array.from(this.canvas[0].getContext('2d').getImageData(loc[0], loc[1], 1, 1).data);
            vertex.color = vertex.mask.toHex();
            regionColors[vertex.color] = 1;
            

            this.vertexData.push(vertex);
        });
        this.regions = Object.keys(regionColors);
        console.log(this.regions);
    }

    render() {
        this._renderSvg();
        this._renderImages();
        this._renderMask()
        .then(() => {
            this._renderShapes();
            this.svg.attr("viewbox", `0 0 ${this.width} ${this.height}`);
            this.svg.attr("width", this.width);
            this.svg.attr("height", this.height);
        });
    }
};

const voronoi = {};

$(document).ready(() => {
    $(".voronoi").each(function(){
        if (!$(this).attr("id")) {
            console.warn("Missing ID for a Voronoi element");
            return;
        }
        voronoi[$(this).attr("id")] = new Voronoi($(this));
    })
});