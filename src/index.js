import JSZip, { file } from 'jszip';

async function updateFilelist(){
    await getAsyncImagesObject().then((data) => window.input_images = data);
    if(window.input_images){
        let source_images_keys = Object.keys(window.input_images);
        let target_element = document.getElementById('preview-input-image');
        
        while(target_element.firstChild){
            element.removeChild(element.firstChild);
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
    target_canvas.getContext('2d').drawImage(source_image, 0, 0);
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
    document.getElementById('source-image').addEventListener('change', updateFilelist);
    document.getElementById('preview-input-image').addEventListener('change', updatePreviewResult);
    document.getElementById('output-result').addEventListener('click', saveResultFile);
});
