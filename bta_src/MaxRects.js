MaxRects = function() {}

/**
 * Referenced by https://github.com/soimy/maxrects-packer/blob/master/src/maxrects-bin.ts
 * All credits to the original authors.
 */
MaxRects.pack = function (inputRects, maxWidth, maxHeight, padding, options)
{
    var createRect = function(w, h, x, y, rot, allowRot) {
        return {
            width: w,
            height: h,
            x: x == null ? 0 : x,
            y: y == null ? 0 : y,
            rot: rot,
            allowRotation: allowRot,
            data: {}
        }
    };

    var rectCollide = function(first, second) {
        return !(
            second.x >= first.x + first.width ||
            second.x + second.width <= first.x ||
            second.y >= first.y + first.height ||
            second.y + second.height <= first.y
        );
    };

    var rectContain = function(first, second) {
        return (
            second.x >= first.x &&
            second.y >= first.y &&
            second.x + second.width <= first.x + first.width &&
            second.y + second.height <= first.y + first.height
        );
    };
    
    var bin = {
        options: options,
        maxWidth: maxWidth,
        maxHeight: maxHeight,
        padding: padding,
        border: options.border,
        width: 0,
        height: 0,
        verticalExpand: false
    }

    var initFree = createRect(
        bin.maxWidth + bin.padding - bin.border * 2,
        bin.maxHeight + bin.padding - bin.border * 2,
        bin.border,
        bin.border
    );
    bin.freeRects = [initFree];

    bin.stage = createRect(bin.width, bin.height);

    var computeScore = function(r, w, h) {
        return Math.min(r.width - w, r.height - h);
    };

    // find best free rect
    var findNode = function(w, h, allowRotation)
    {
        var bestScore = 999999999;
        var bestNode = null;
        var i = 0;
        var flen = bin.freeRects.length;
        
        while (i < flen)
        {
            var r = bin.freeRects[i];

            // normal
            if (r.width >= w && r.height >= h) {
                var score = computeScore(r, w, h);
                if (score < bestScore) {
                    bestScore = score;
                    bestNode = createRect(w, h, r.x, r.y, false);
                }
            }

            // rotated
            if (allowRotation && r.width >= h && r.height >= w) {
                var score = computeScore(r, h, w);
                if (score < bestScore) {
                    bestScore = score;
                    bestNode = createRect(h, w, r.x, r.y, true);
                }
            }
            i++;
        }
        return bestNode;
    };

    var splitNode = function(freeRect, usedNode)
    {
        if (!rectCollide(freeRect, usedNode))
            return false;

        // vertical splits
        if (usedNode.x < freeRect.x + freeRect.width && usedNode.x + usedNode.width > freeRect.x)
        {
            if (usedNode.y > freeRect.y && usedNode.y < freeRect.y + freeRect.height)
            {
                var new1 = createRect(freeRect.width, usedNode.y - freeRect.y, freeRect.x, freeRect.y);
                bin.freeRects.push(new1);
            }
            
            if (usedNode.y + usedNode.height < freeRect.y + freeRect.height)
            {
                var new2 = createRect(
                    freeRect.width,
                    freeRect.y + freeRect.height - (usedNode.y + usedNode.height),
                    freeRect.x,
                    usedNode.y + usedNode.height
                );
                bin.freeRects.push(new2);
            }
        }

        // horizontal splits
        if (usedNode.y < freeRect.y + freeRect.height && usedNode.y + usedNode.height > freeRect.y)
        {
            if (usedNode.x > freeRect.x && usedNode.x < freeRect.x + freeRect.width)
            {
                var new3 = createRect(usedNode.x - freeRect.x, freeRect.height, freeRect.x, freeRect.y);
                bin.freeRects.push(new3);
            }

            if (usedNode.x + usedNode.width < freeRect.x + freeRect.width)
            {
                var new4 = createRect(
                    freeRect.x + freeRect.width - (usedNode.x + usedNode.width),
                    freeRect.height,
                    usedNode.x + usedNode.width,
                    freeRect.y
                );
                bin.freeRects.push(new4);
            }
        }
        return true;
    };

    var pruneFreeList = function()
    {
        var i = 0;
        while (i < bin.freeRects.length)
        {
            var j = i + 1;
            while (j < bin.freeRects.length)
            {
                var r1 = bin.freeRects[i];
                var r2 = bin.freeRects[j];
               
                if (rectContain(r2, r1)) {
                    bin.freeRects.splice(i, 1);
                    i--;
                    break;
                }
                
                if (rectContain(r1, r2)) {
                    bin.freeRects.splice(j, 1);
                    j--;
                }
               
                j++;
            }
            i++;
        }
    };

    var updateBinSize = function(node)
    {
        if (rectContain(bin.stage, node))
            return false;

        var w = Math.max(bin.width, node.x + node.width - bin.padding + bin.border);
        var h = Math.max(bin.height, node.y + node.height - bin.padding + bin.border);

        if (bin.options.allowRotation)
        {
            var rotW = Math.max(bin.width, node.x + node.height - bin.padding + bin.border);
            var rotH = Math.max(bin.height, node.y + node.width - bin.padding + bin.border);
            var fits = !(w > bin.maxWidth || h > bin.maxHeight);
            var rotFits = !(rotW > bin.maxWidth || rotH > bin.maxHeight);
            
            if (fits && rotFits && rotW * rotH < w * h) {
                w = rotW;
                h = rotH;
            }
            else if (rotFits && !fits) {
                w = rotW;
                h = rotH;
            }
        }

        w = Math.pow(2, Math.ceil(Math.log(w) / 0.6931471805599453));
        h = Math.pow(2, Math.ceil(Math.log(h) / 0.6931471805599453));

        if (w > bin.maxWidth || h > bin.maxHeight)
            return false;

        // expand free rects
        var i = 0;
        while (i < bin.freeRects.length) {
            var r = bin.freeRects[i];
            if (r.x + r.width >= Math.min(bin.width + bin.padding - bin.border, w + bin.padding)) {
                r.width = (w + bin.padding) - r.x - bin.border;
            }
            if (r.y + r.height >= Math.min(bin.height + bin.padding - bin.border, h + bin.padding)) {
                r.height = (h + bin.padding) - r.y - bin.border;
            }
            i++;
        }

        var new1 = createRect(
            (w + bin.padding) - bin.width - bin.padding,
            (h + bin.padding) - bin.border * 2,
            bin.width + bin.padding - bin.border,
            bin.border
        );

        var new2 = createRect(
            (w + bin.padding) - bin.border * 2,
            (h + bin.padding) - bin.height - bin.padding,
            bin.border,
            bin.height + bin.padding - bin.border
        );

        bin.freeRects.push(new1);
        bin.freeRects.push(new2);

        var filtered = [];
        i = 0;
        while (i < bin.freeRects.length) {
            var r = bin.freeRects[i];
            if (r.width > 0 && r.height > 0 && r.x >= bin.border && r.y >= bin.border) {
                filtered.push(r);
            }
            i++;
        }
        bin.freeRects = filtered;

        pruneFreeList();

        bin.width = w;
        bin.height = h;
        bin.stage.width = w;
        bin.stage.height = h;
        return true;
    };

    var place = function(rect)
    {
        var allowRotation = (rect.allowRotation != null) ? rect.allowRotation : bin.options.allowRotation;
        var node = findNode(rect.width + bin.padding, rect.height + bin.padding, allowRotation);

        if (node)
        {
            updateBinSize(node);

            var i = 0;
            var num = bin.freeRects.length;
           
            while (i < num) {
                if (splitNode(bin.freeRects[i], node)) {
                    bin.freeRects.splice(i, 1);
                    num--;
                    i--;
                }
                i++;
            }
            
            pruneFreeList();

            // apply position n rotation
            rect.x = node.x;
            rect.y = node.y;

            if (node.rot) {
                var tmp = rect.width;
                rect.width = rect.height;
                rect.height = tmp;
                rect.rot = true;
            }
            else {
                rect.rot = false;
            }

            bin.verticalExpand = (bin.width > bin.height);

            return true;
        }

        var expand1 = null;
        var expand2 = null;

        if (!bin.verticalExpand) {
            expand1 = createRect(rect.width + bin.padding, rect.height + bin.padding, bin.width + bin.padding - bin.border, bin.border);
            expand2 = createRect(rect.width + bin.padding, rect.height + bin.padding, bin.border, bin.height + bin.padding - bin.border);
        }
        else {
            expand1 = createRect(rect.width + bin.padding, rect.height + bin.padding, bin.border, bin.height + bin.padding - bin.border);
            expand2 = createRect(rect.width + bin.padding, rect.height + bin.padding, bin.width + bin.padding - bin.border, bin.border);
        }

        if (updateBinSize(expand1) || updateBinSize(expand2)) {
            return place(rect);
        }

        return false;
    };

    // prepare input rectangles
    var toPack = [];
    var i = 0;
    while (i < inputRects.length) {
        var orig = inputRects[i];
        var rect = createRect(orig.width, orig.height);
        if (orig.allowRotation != null) rect.allowRotation = orig.allowRotation;
        if (orig.data != null) rect.data = orig.data;
        rect.originalIndex = i;
        toPack.push(rect);
        i++;
    }

    // sort
    var n = toPack.length;
    var swapped;
    do {
        swapped = false;
        var j = 0;
        while (j < n - 1) {
            var a = toPack[j];
            var b = toPack[j + 1];
            var scoreA = Math.max(a.width, a.height);
            var scoreB = Math.max(b.width, b.height);
            if (scoreB > scoreA) {
                toPack[j] = b;
                toPack[j + 1] = a;
                swapped = true;
            }
            j++;
        }
        n--;
    } while (swapped);

    // pack
    i = 0;
    while (i < toPack.length) {
        place(toPack[i++]);
    }

    var result = [];
    i = 0;
    while (i < toPack.length) {
        var r = toPack[i];
        var out = {
            x: r.x, y: r.y,
            isRotated: r.rot,
            width: r.width, height: r.height
        }

        if (r.data != null) {
            var p;
            for (p in r.data) {
                out[p] = r.data[p];
            }
        }

        result[r.originalIndex] = out;
        i++;
    }

    return result;
}