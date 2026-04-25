import flash.display.BitmapData;
import flash.geom.Matrix;
import flash.filesystem.File;
import flash.filesystem.FileMode;
import flash.filesystem.FileStream;
import flash.events.MouseEvent;
import flash.text.TextField;
import flash.text.TextFormat;
import flash.utils.ByteArray;

/**
 * Referenced by https://github.com/cameron314/PNGEncoder2/blob/master/PNGEncoder.hx
 * All credits to the original authors.
 */

// TODO: switch to PNGEncoder2, faster probably idk
// should probably try to optimize other things around here too

var crcTable:Array;
var crcTableComputed:Boolean = false;

function writeChunk(png:ByteArray, type:uint, data:ByteArray):void {
    var c:uint;
    if (!crcTableComputed) {
        crcTableComputed = true;
        crcTable = [];
        for (var n:uint = 0; n < 256; n++) {
            c = n;
            for (var k:uint = 0; k < 8; k++) {
                if (1 == (c & 1)) c = 0xedb88320 ^ (c >>> 1);
                else c = c >>> 1;
            }
            crcTable[n] = c;
        }
    }

    var len:uint = (data != null) ? data.length : 0;
    png.writeUnsignedInt(len);

    var p:uint = png.position;
    png.writeUnsignedInt(type);
    if (data != null) png.writeBytes(data);

    var e:uint = png.position;
    png.position = p;
    c = 0xffffffff;
    for (var i:int = 0; i < (e - p); i++) {
        c = crcTable[(c ^ png.readUnsignedByte()) & 0xff] ^ (c >>> 8);
    }
    c ^= 0xffffffff;
    png.position = e;
    png.writeUnsignedInt(c);
}

function encodeTiled(totalWidth:int, totalHeight:int, tiles:Array, numTilesX:int, numTilesY:int, maxTileSize:int = 2880):ByteArray
{
    var png:ByteArray = new ByteArray();
    png.writeUnsignedInt(0x89504e47);
    png.writeUnsignedInt(0x0D0A1A0A);

    var IHDR:ByteArray = new ByteArray();
    IHDR.writeInt(totalWidth);
    IHDR.writeInt(totalHeight);
    IHDR.writeUnsignedInt(0x08060000); // 32 bit rgba
    IHDR.writeByte(0);
    writeChunk(png, 0x49484452, IHDR);

    // find tile for each pixel
    var IDAT:ByteArray = new ByteArray();
    for (var y:int = 0; y < totalHeight; y++) {
        IDAT.writeByte(0);

        var tileRow:int = y / maxTileSize;
        var localY:int  = y % maxTileSize;

        for (var x:int = 0; x < totalWidth; x++) {
            var tileCol:int = x / maxTileSize;
            var localX:int  = x % maxTileSize;

            var tileIndex:int = tileRow * numTilesX + tileCol;
            var tile:BitmapData = tiles[tileIndex];

            var p:uint = tile.getPixel32(localX, localY);
            IDAT.writeUnsignedInt(((p & 0xFFFFFF) << 8) | (p >>> 24));
        }
    }

    IDAT.compress();
    writeChunk(png, 0x49444154, IDAT);
    writeChunk(png, 0x49454E44, null);

    png.position = 0;
    return png;
}

function savePNG():void
{
    const MAX_TILE:int = 2880; // max bitmap size in cs4
    const MAX_ANIMATE_TILE:int = 8192;
    
    var fullW:int = $SHEETWIDTH;
    var fullH:int = $SHEETHEIGHT;
    
    if (fullW > MAX_ANIMATE_TILE || fullH > MAX_ANIMATE_TILE) {
        trace("WARNING: The maximun supported size is supposed to be " + MAX_ANIMATE_TILE + "px");
        //return;
    }
    
    var numTilesX:int = Math.ceil(fullW / MAX_TILE);
    var numTilesY:int = Math.ceil(fullH / MAX_TILE);
    
    // divide the thing into tiles
    var tiles:Array = [];
    for (var ty:int = 0; ty < numTilesY; ty++) {
        for (var tx:int = 0; tx < numTilesX; tx++) {
            var tileW:int = Math.min(MAX_TILE, fullW - tx * MAX_TILE);
            var tileH:int = Math.min(MAX_TILE, fullH - ty * MAX_TILE);
            
            var tileBMD:BitmapData = new BitmapData(tileW, tileH, true, 0x00FFFFFF);
            
            var matrix:Matrix = new Matrix();
            matrix.tx = -tx * MAX_TILE;
            matrix.ty = -ty * MAX_TILE;
            
            tileBMD.draw(stage, matrix);
            tiles.push(tileBMD);
        }
    }
    
    var pngBytes:ByteArray = encodeTiled(fullW, fullH, tiles, numTilesX, numTilesY);
    var saveFile:File = new File("$SPRITEMAPPATH");
    var stream:FileStream = new FileStream();
    stream.open(saveFile, FileMode.WRITE);
    stream.writeBytes(pngBytes, 0, pngBytes.length);
    stream.close();
    
    trace("PNG saved to: " + saveFile.nativePath);
}

savePNG();

if (stage && stage.nativeWindow) {
   stage.nativeWindow.close();
}