import JSZip, { file } from 'jszip';

async function updateFilelist(){
    await getAsyncImagesObject().then((data) => window.input_images = data);
    if(window.input_images){
        let source_images_keys = Object.keys(window.input_images);
        let target_element = document.getElementById('input-preview');
        
        while(target_element.firstChild){
            target_element.removeChild(target_element.firstChild);
        }
        
        for (let i = 0; i < source_images_keys.length; i++) {
            let list_option = document.createElement('option');
            list_option.value = source_images_keys[i];
            list_option.textContent = source_images_keys[i];
        
            target_element.appendChild(list_option);
        }
    }
}

function updatePreviewResult(){
    let target_canvas = document.getElementById('composite-preview');
    let source_selection = document.getElementById('input-preview').value;
    let source_image = window.input_images[source_selection];
    
    if(source_image) getMixedCanvas(source_image, target_canvas);
}

/**
 * @param imagedata imageData that you want to grayscale.
 * @returns imageData
 */
function getGrayscaledImageData(imagedata){
    // NOTE: imageDataのピクセルは[R_1,G_1,B_1,A_1,R_2,...]という形の一次元配列
    // なので、for文のindex変数は毎回+4(Alphaを無視)している
    for(let i = 0; i < imagedata.data.length; i += 4){
        let r = imagedata.data[i];
        let g = imagedata.data[i+1];
        let b = imagedata.data[i+2];
        let grayscale = r * 0.299 + g * 0.587 + b * 0.114;
        imagedata.data[i] = grayscale;
        imagedata.data[i+1] = grayscale;
        imagedata.data[i+2] = grayscale;
    }
    
    return imagedata;
}

function getGradientMappedImageData(imagedata){
    let gradient = document.getElementById('input-gradation');
    let gradient_data = gradient.getContext('2d').getImageData(0, 0, gradient.width, gradient.height);
    
    for(let i = 0; i < imagedata.data.length; i += 4){
        let v = Math.max(imagedata.data[i], imagedata.data[i+1], imagedata.data[i+2]);
        let new_r = gradient_data.data[v * 4];
        let new_g = gradient_data.data[v * 4 + 1];
        let new_b = gradient_data.data[v * 4 + 2];
        
        imagedata.data[i] = new_r;
        imagedata.data[i+1] = new_g;
        imagedata.data[i+2] = new_b;
    }
    
    return imagedata;
}

function updateGradientPreview(){
    let target_canvas = document.getElementById('input-gradation');
    let context = target_canvas.getContext('2d');
    
    let gradient = context.createLinearGradient(0, 0, 256, 0);
    let color_stop = getGradientColorStops();
    
    for(let i = 0; i < color_stop.length; ++i){
        let color = color_stop[i].color;
        let point = color_stop[i].point;
        gradient.addColorStop(point, color);
    }
    
    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 1);
}

/**
 * Get color stop parameters from input area
 * @returns Array[ Object {color: "#hex", point: number}, ... ]
 */
function getGradientColorStops(){
    let gradient_parameters = document.getElementsByClassName('gradient-color');
    let result = [];
    
    for(let i = 0; i < gradient_parameters.length; ++i){
        let color = gradient_parameters[i].getElementsByClassName('color-stop')[0].value;
        let point = gradient_parameters[i].getElementsByClassName('color-stop-point')[0].value;
        
        let colorstop = {
            color: color,
            point: parseFloat(point)
        };
        result.push(colorstop);
    }
    
    return result;
}

// とりあえず画像が単一ならそのまま、複数ならzip化してダウンロードさせるとこまで
async function saveResultFile(){
    let target_object = window.input_images;
    let filename_keys = Object.keys(target_object);
    
    if(filename_keys.length){
        if(filename_keys.length > 1){
            let zip = new JSZip();
            
            for(let i = 0; i < filename_keys.length; ++i){
                let canvas_tosave = getMixedCanvas(target_object[filename_keys[i]]);
                let imagefile = await getArraybuffer_fromCanvas(canvas_tosave);
                zip.file(filename_keys[i], imagefile, {binary: true});
            }
            
            zip.generateAsync({type:"blob"}).then((content) => {
                let zipurl = URL.createObjectURL(content);
                let save_link = document.createElement('a');
                
                save_link.download = 'result.zip';
                save_link.href = zipurl;
                document.body.appendChild(save_link);
                save_link.click();
                
                // NOTE: データの解放。ダウンロード前に解放されるケースがあるらしいので、一応遅らせる
                save_link.remove();
                setTimeout(() => {
                    URL.revokeObjectURL(zipurl);
                }, 1e4);
            });
        } else {
            let save_link = document.createElement('a');
            let mixed_image = getMixedCanvas(target_object[filename_keys[0]]);
            
            save_link.download = filename_keys[0];
            save_link.href = mixed_image.toDataURL('image/png');
            
            document.body.appendChild(save_link);
            save_link.click();
            
            save_link.remove();
            setTimeout(() => {
                URL.revokeObjectURL(save_link.href);
            }, 1e4);
        }
    }
}

async function getArraybuffer_fromCanvas(canvas){
    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            let reader = new FileReader();
            reader.readAsArrayBuffer(blob);
            reader.addEventListener('load', () => {
                resolve(reader.result);
            });
        });
    });
}

function getMixedCanvas(image, other_canvas = null){
    let canvas = other_canvas || document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    
    let context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    
    let raw_imagedata = context.getImageData(0, 0, image.width, image.height);
    let grayscaled_imagedata = getGrayscaledImageData(raw_imagedata);
    let applied_gradientmap = getGradientMappedImageData(grayscaled_imagedata);
    context.putImageData(applied_gradientmap, 0, 0);
    
    return canvas;
}

/**
 * Return object asigned image files with name keys.
 * @returns Promise<Object{'filename': img, ...}>
 */
async function getAsyncImagesObject(){
    let result = {};
    let source_files = document.getElementById('source-image').files;
    
    if(source_files.length !== 0) {
        for (let i = 0; i < source_files.length; i++) {
            let filename = source_files[i].name
            let loaded = await readImageFile(source_files[i]);
            result[filename] = loaded;
        }
    }
    return result;
}

function readImageFile(file){
    let reader = new FileReader();
    
    return new Promise((resolve) => {
        reader.readAsDataURL(file);
        
        reader.addEventListener('load', () => {
            let image = new Image();
            image.src = reader.result;
            resolve(image);
        });
    });
}

/**
 * Create form that contains the color-stop parts:
 * - Checkbox(for remove checked color-stop)
 * - Color picker
 * - Range
 * - Range value viewer
 * @returns HTMLformElement
 */
function createColorStopElement(){
    let input_checkbox = document.createElement('input');
    let property_checkbox = {
        type: 'checkbox',
        className: 'selection-remove'
    };
    Object.assign(input_checkbox, property_checkbox);
    
    let input_color = document.createElement('input');
    let property_color = {
        type: 'color',
        className: 'color-stop'
    };
    Object.assign(input_color, property_color);
    
    let input_range = document.createElement('input');
    let property_range = {
        type: 'range',
        className: 'color-stop-point',
        name: 'stop_point',
        min: '0.00',
        max: '1.00',
        step: '0.01',
        value: '0.50'
    };
    Object.assign(input_range, property_range);
    
    let range_view = document.createElement('output');
    let property_range_view = {
        name: 'point_position',
        for: 'stop_point',
        innerText: '0.5'
    };
    Object.assign(range_view, property_range_view);
    
    let result = document.createElement('form');
    result.className = 'gradient-color';
    result.addEventListener('input', () => range_view.innerText = input_range.value);
    result.appendChild(input_checkbox);
    result.appendChild(input_color);
    result.appendChild(input_range);
    result.appendChild(range_view);
    
    return result;
}

function removeSelectedColorStop(){
    let target_root = document.getElementById('gradient-parameter');
    
    let color_stops = target_root.getElementsByClassName('gradient-color');
    for(let i = 0, element_length = color_stops.length; i < element_length; ++i){
        let checkbox = color_stops[i].getElementsByClassName('selection-remove');
        if(checkbox.length > 0){
            let remove_flag = checkbox[0].checked;
            
            if(remove_flag){
                target_root.removeChild(color_stops[i]);
                --i;
                --element_length;
            }
        }
    }
}

window.addEventListener('load', () => {
    updateGradientPreview();
    
    let color_stops = document.getElementsByClassName('gradient-color');
    let updatePreviews = () => {
        updateGradientPreview();
        if(window.input_images) updatePreviewResult();
    };
    let initGradientElements = (root_element) => {
        root_element.getElementsByClassName('color-stop')[0].addEventListener('input', updatePreviews);
        root_element.getElementsByClassName('color-stop-point')[0].addEventListener('input', updatePreviews);
    };
    
    for(let i = 0; i < color_stops.length; ++i){
        initGradientElements(color_stops[i]);
    }
    
    document.getElementById('add-colorstop').addEventListener('click', () => {
        let new_color_stop = createColorStopElement();
        initGradientElements(new_color_stop);
        document.getElementById('gradient-parameter').appendChild(new_color_stop);
        updatePreviews();
    });
    document.getElementById('remove-colorstop').addEventListener('click', () => {
        removeSelectedColorStop();
        updatePreviews();
    });
    
    document.getElementById('source-image').addEventListener('change', updateFilelist);
    document.getElementById('input-preview').addEventListener('change', updatePreviewResult);
    document.getElementById('output-result').addEventListener('click', saveResultFile);
});
