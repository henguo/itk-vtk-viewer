import { reaction } from 'mobx';

import style from '../ItkVtkViewer.module.css';

function createColorRangeInput(
  store,
  uiContainer,
) {

  const minimumInput = document.createElement('input');
  minimumInput.type = 'number';
  minimumInput.setAttribute('class', style.numberInput);
  const maximumInput = document.createElement('input');
  maximumInput.type = 'number';
  maximumInput.setAttribute('class', style.numberInput);

  function updateColorTransferFunction() {
    const selectedGeometryIndex = store.geometriesUI.selectedGeometryIndex;
    const colorRanges = store.geometriesUI.colorRanges[selectedGeometryIndex];
    const colorByKey = store.geometriesUI.colorBy[selectedGeometryIndex].value;
    const colorRange = colorRanges.get(colorByKey);

    const proxy = store.geometriesUI.representationProxies[selectedGeometryIndex];
    const [colorByArrayName, location] = proxy.getColorBy();
    const lutProxy = proxy.getLookupTableProxy(colorByArrayName, location);
    const colorTransferFunction = lutProxy.getLookupTable();
    const colorPreset = store.geometriesUI.colorPresets[selectedGeometryIndex];
    lutProxy.setPresetName(colorPreset);
    colorTransferFunction.setMappingRange(...colorRange);
    colorTransferFunction.updateRange();
    store.renderWindow.render();

    minimumInput.value = colorRange[0];
    maximumInput.value = colorRange[1];
  }

  function updateColorRangeInput() {
    const selectedGeometryIndex = store.geometriesUI.selectedGeometryIndex;
    if (!store.geometriesUI.hasScalars[selectedGeometryIndex]) {
      return;
    }
    const colorByKey = store.geometriesUI.colorBy[selectedGeometryIndex].value;
    const [location, colorByArrayName] = colorByKey.split(':');
    const geometry = store.geometriesUI.geometries[selectedGeometryIndex];
    const dataArray = location === 'pointData' ?
      geometry.getPointData().getArrayByName(colorByArrayName) :
      geometry.getCellData().getArrayByName(colorByArrayName);
    const range = dataArray.getRange();

    minimumInput.min = range[0];
    minimumInput.max = range[1];
    maximumInput.min = range[0];
    maximumInput.max = range[1];
    const data = dataArray.getData();
    if (data instanceof Float32Array || data instanceof Float64Array) {
      const step = (range[1] - range[0]) / 100.0;
      minimumInput.step = step;
      maximumInput.step = step;
    }
    updateColorTransferFunction();
  }

  function setDefaultColorRanges() {
    const colorByOptions = store.geometriesUI.colorByOptions;
    if(!!!colorByOptions || colorByOptions.length === 0) {
      return;
    }

    const geometries = store.geometriesUI.geometries;
    colorByOptions.forEach((options, index) => {
      const geometry = geometries[index];
      if (store.geometriesUI.colorRanges.length <= index) {
        const colorRanges = new Map();
        if (options) {
          options.forEach((option) => {
            const [location, colorByArrayName] = option.value.split(':');
            const dataArray = location === 'pointData' ?
              geometry.getPointData().getArrayByName(colorByArrayName) :
              geometry.getCellData().getArrayByName(colorByArrayName);
            const range = dataArray.getRange();
            colorRanges.set(option.value, range);
          })
        }
        store.geometriesUI.colorRanges.push(colorRanges);
      } else {
        const colorRanges = store.geometriesUI.colorRanges[index];
        !!options && options.forEach((option) => {
          const [location, colorByArrayName] = option.value.split(':');
          const dataArray = location === 'pointData' ?
            geometry.getPointData().getArrayByName(colorByArrayName) :
            geometry.getCellData().getArrayByName(colorByArrayName);
          const range = dataArray.getRange();

          if (colorRanges.has(option.value)) {
            const current = colorRanges.get(option.value);
            if (current[0] < range[0] || current[1] > range[1]) {
              const newRange = current.slice();
              if (current[0] < range[0]) {
                newRange[0] = range[0];
              }
              if (current[1] > range[1]) {
                newRange[1] = range[1];
              }
              colorRanges.set(option.value, newRange);
            }
          } else {
            colorRanges.set(option.value, range);
          }
        })
      }
    })
    updateColorRangeInput();
  }

  setDefaultColorRanges();

  minimumInput.addEventListener('change',
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      const selectedGeometryIndex = store.geometriesUI.selectedGeometryIndex;
      const colorByKey = store.geometriesUI.colorBy[selectedGeometryIndex].value;
      const range = store.geometriesUI.colorRanges[selectedGeometryIndex].get(colorByKey);
      range[0] = Number(event.target.value);
      store.geometriesUI.colorRanges[selectedGeometryIndex].set(colorByKey, range);
      updateColorTransferFunction();
    }
  );
  maximumInput.addEventListener('change',
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      const selectedGeometryIndex = store.geometriesUI.selectedGeometryIndex;
      const colorByKey = store.geometriesUI.colorBy[selectedGeometryIndex].value;
      const range = store.geometriesUI.colorRanges[selectedGeometryIndex].get(colorByKey);
      range[1] = Number(event.target.value);
      store.geometriesUI.colorRanges[selectedGeometryIndex].set(colorByKey, range);
      updateColorTransferFunction();
    }
  );

  const canvas = document.createElement('canvas');
  const width = 240;
  const height = 20;
  canvas.setAttribute('width', width);
  canvas.setAttribute('height', height);

  function updateColorCanvas() {
    const selectedGeometryIndex = store.geometriesUI.selectedGeometryIndex;
    if (!store.geometriesUI.hasScalars[selectedGeometryIndex]) {
      return;
    }
    const colorByKey = store.geometriesUI.colorBy[selectedGeometryIndex].value;
    const range = store.geometriesUI.colorRanges[selectedGeometryIndex].get(colorByKey);

    const proxy = store.geometriesUI.representationProxies[selectedGeometryIndex];
    const [colorByArrayName, location] = proxy.getColorBy();
    const lutProxy = proxy.getLookupTableProxy(colorByArrayName, location);
    const colorPreset = store.geometriesUI.colorPresets[selectedGeometryIndex];
    lutProxy.setPresetName(colorPreset);
    const colorTransferFunction = lutProxy.getLookupTable();
    colorTransferFunction.setMappingRange(...range);
    colorTransferFunction.updateRange();
    const ctx = canvas.getContext('2d');

    const rgba = colorTransferFunction.getUint8Table(
      range[0],
      range[1],
      width,
      4,
    );
    const pixelsArea = ctx.getImageData(0, 0, width, 256);
    for (let lineIdx = 0; lineIdx < 256; lineIdx++) {
      pixelsArea.data.set(rgba, lineIdx * 4 * width);
    }

    const nbValues = 256 * width * 4;
    const lineSize = width * 4;
    for (let i = 3; i < nbValues; i += 4) {
      pixelsArea.data[i] = 255 - Math.floor(i / lineSize);
    }

    ctx.putImageData(pixelsArea, 0, 0);
  }

  updateColorCanvas();

  reaction(() => { return store.geometriesUI.colorByOptions.slice(); },
    () => {
      setDefaultColorRanges();
    }
  )

  reaction(() => { return store.geometriesUI.selectedGeometryIndex; },
    (selectedGeometryIndex) => {
      const hasScalars = store.geometriesUI.hasScalars;
      if (hasScalars[selectedGeometryIndex]) {
        uiContainer.style.display = 'flex';
        updateColorCanvas();
        updateColorRangeInput();
      } else {
        uiContainer.style.display = 'none';
      }
    }
  )
  reaction(() => { return store.geometriesUI.colorPresets.slice(); },
    () => {
      updateColorCanvas();
      updateColorRangeInput();
    }
  )

  reaction(() => { return store.geometriesUI.colorBy.slice(); },
    () => {
      updateColorCanvas();
      updateColorRangeInput();
    }
  )

  const hasScalars = store.geometriesUI.hasScalars;
  const selectedGeometryIndex = store.geometriesUI.selectedGeometryIndex;
  if (hasScalars[selectedGeometryIndex]) {
    uiContainer.style.display = 'flex';
  } else {
    uiContainer.style.display = 'none';
  }

  uiContainer.appendChild(minimumInput);
  uiContainer.appendChild(canvas);
  uiContainer.appendChild(maximumInput);
}

export default createColorRangeInput;