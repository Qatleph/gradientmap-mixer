import JSZip, { file } from 'jszip';

async function updateFilelist(){
    await getAsyncImagesObject().then((data) => window.input_images = data);
    if(window.input_images){
        let source_images_keys = Object.keys(window.input_images);
        let target_element = document.getElementById('preview-input-image');
        
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
    let source_selection = document.getElementById('preview-input-image').value;
    let source_image = window.input_images[source_selection];
    
    target_canvas.width = source_image.width;
    target_canvas.height = source_image.height;
    
    let context = target_canvas.getContext('2d');
    context.drawImage(source_image, 0, 0);
    
    let current_imagedata = context.getImageData(0, 0, source_image.width, source_image.height);
    let grayscaled_imagedata = getGrayscaledImageData(current_imagedata);
    let applied_gradientmap = getGradientMappedImageData(grayscaled_imagedata);
    context.putImageData(applied_gradientmap, 0, 0);
}

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
    let gradient = document.getElementById('preview-input-gradation');
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

function updateGradationPreview(){
    let target_canvas = document.getElementById('preview-input-gradation');
    let context = target_canvas.getContext('2d');
    
    let gradient = context.createLinearGradient(0, 0, 256, 0);
    let color_stop = getGradationColorStops();
    
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
function getGradationColorStops(){
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
                let canvas_tosave = getDrewCanvas(target_object[filename_keys[i]]);
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
            save_link.download = filename_keys[0];
            save_link.href = target_object[filename_keys[0]].src;
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

// test function
function getDrewCanvas(image){
    let canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    
    canvas.getContext('2d').drawImage(image, 0, 0);
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

window.addEventListener('load', () => {
    updateGradationPreview();
    let color_stops = document.getElementsByClassName('gradient-color');
    for(let i = 0; i < color_stops.length; ++i){
        color_stops[i].getElementsByClassName('color-stop')[0].addEventListener('input', updateGradationPreview);
        color_stops[i].getElementsByClassName('color-stop-point')[0].addEventListener('input', updateGradationPreview);
    }
    document.getElementById('source-image').addEventListener('change', updateFilelist);
    document.getElementById('preview-input-image').addEventListener('change', updatePreviewResult);
    document.getElementById('output-result').addEventListener('click', saveResultFile);
});
