<picture>
 <img src="https://github.com/user-attachments/assets/a7db43ad-ecda-4b53-9c5b-ed8efc834c64" alt="BetterTA" width="950"> 
</picture>

<hr>

<h1>BetterTextureAtlas </h1>
BetterTextureAtlas is an Adobe Animate extension that tries to enhance the Texture Atlas exports,<br> 
Adding features and fixing its Animation file format so it presents more data for the user to easily change whether in-game or by tweaking values.

> [!NOTE]
> Due to how JSFL works, tweened frame values is something hard to access, and we couldn't yet add baked tweens.<br>
> If your animation contains tweens, convert your tweens to keyframes first.<br>
> Support for Flash CS6 and specially CS4 is still really primitive, we recommend exporting using newer Animate versions.

## What differs from the default Texture Atlas Exporter?

<details>
  <summary><b>Features</b></summary>

  * [x] Blend Mode Support
  * [x] Baked Filters Support
  * [x] Matrix reformatting
  * [x] Multi-Symbol Support
  * [x] Extra Metadata
  * [x] Dynamic Tweening values
  * [x] Sound support with its according settings (Event, Stream)
  * [ ] Vector Support 
</details>

<details>
  <summary><b>Fixes</b></summary>

  * [x] Reformatting of Filters
  * [x] Filtered One Frame Symbols matrix errors
  * [x] Optimized exports (being able to export 5~ SWF videos with relative ease)
</details>

<hr>

## How to install

<details>
 <summary><b>With an Extension Manager</b> (advisable)</summary><hr>
With the <b>Extension Manager</b> open, whether from the Command Line or as an application, you install the extension, this should be known whether you use an application that comes within your Flash app or the CMD tool.<br><br>

That being said, if you're using the <b>Extension Manager</b> app, just accept the license it'll be provided and it should be good to go.

<hr></details>

<details>
 <summary><b>Manually</b></summary><hr>
 
 To install them manually, you need to go to <br>``C:\Users\[UserName]\AppData\Local\Adobe\[Flash/Animate version]\[yourLocale]\Configuration\Commands``<br>
Example: ``C:\Users\sotif\AppData\Local\Adobe\Animate 2022\en_US\Configuration\Commands``

With your `zxp` file, rename the extension to `zip` so you can extract the contents, except `BetterTextureAtlas.mxi` (this is only useful for the Extension Managers mentioned before)
<br><b>Pro Tip</b>: You can search where should the files be placed in the `mxi` file, specifically on the `<files>` block.

<hr></details>

After installing the extension, you should restart the program if it's currently running, and after that it should pop up in the `Commands` tab.

## How to use the extension

Select the symbol that you wanna export an click `Commands > BetterTextureAtlas`.
A window will show up with different export settings to export your Texture Atlas.
