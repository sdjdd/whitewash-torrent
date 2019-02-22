class FileManager {
    constructor() {
        this.uploader = document.createElement('input')
        this.uploader.type = 'file'
        this.downloader = document.createElement('a')
        this.lastURL = null

        this.downloader.style['display'] = 'none'
        document.body.appendChild(this.downloader)
    }
    upload(func) {
        this.uploader.onchange = function() {
            let file = this.files[0]
            if (file) {
                func(file, file.name)
            }
        }
        this.uploader.click()
    }
    download(data, filename, type='application/octet-stream') {
        if (this.lastURL) {
            URL.revokeObjectURL(this.lastURL)
        }
        let blob = new Blob([data], {
            type: type,
        })
        this.lastURL = URL.createObjectURL(blob)
        this.downloader.href = this.lastURL
        if (filename) {
            this.downloader.download = filename
        }
        this.downloader.click()
    }
}

export default FileManager