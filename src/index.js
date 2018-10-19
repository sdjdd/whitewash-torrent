/**
 * @author sdjdd <sdjddrt@gmail.com>
 */
import bencode from 'bencode'
import Vue from 'vue/dist/vue.esm'
import FileManager from './file-manager'

var fileManager = new FileManager()    // 管理文件上传\下载
var btData = null                      // 种子数据
var decoder = new TextDecoder('utf8')  // 解码器

Vue.component('item', {
    template: '#item-template',
    props: ['file'],
    computed: {
        convertLength: function() {
            return convertLength(this.file.length)
        },
        checked: function() {
            if (!this.file.parent) {
                return true
            } else if (!this.file.children) {
                return this.file.checked
            }
            for (let i in this.file.children) {
                if (!this.file.children[i].checked) {
                    return false
                }
            }
            return true
        },
    },
    methods: {
        deleteFile: function() {
            deleteFile(this.file)
        },
        changeChecked: function() {
            let checked = this.checked
            for (let i in this.file.children) {
                this.file.children[i].checked = !checked
            }
        },
    },
})

var app = new Vue({
    el: '.container',
    data: {
        files: null,   // 种子文件列表
        filename: '',  // 种子文件名
    },
    methods: {
        upload: function() {
            fileManager.upload((data, filename) => {
                decodeFile(data)
                this.filename = filename
            })
        },
        save: function() {
            if (!btData) {
                alert('未打开种子文件')
                return
            }
            saveChange(this.files)
            let result = bencode.encode(btData)
            fileManager.download(result, this.filename)
        },
        checkAll: function() {
            check(this.files)
        },
        invertCheck: function () {
            check(this.files, true)
        },
        deleteChecked: function() {
            let delList = []
            getCheckedList(this.files, delList)
            for (let i = delList.length-1; i >= 0; i--) {
                deleteFile(delList[i])
            }
        },
    },
})

// 调试用
window.app = app
window.btData = function() {
    return btData
}

function decodeFile(file) {
    let reader = new FileReader()
    reader.onload = (e) => {
        try {
            btData = bencode.decode(e.target.result)
            let files = convertToFileTree(btData)
            app.files = files
        } catch (err) {
            console.error(err)
            alert('文件格式不正确')
        }
    }
    reader.readAsArrayBuffer(file)
}

// 将Torrent中的文件信息转化为树形目录格式
function convertToFileTree(bt) {
    let id = 1
    let rootName = decoder.decode(bt.info['name.utf-8'] || bt.info['name'])  // 目录\单一文件名, 优先使用UTF-8编码
    let root = {
        id: id++,
        name: rootName,        // 新文件\目录名, 修改时以此为准
        originName: rootName,  // 原始文件\目录名
        //checked: true,         // 视图中该条目的checkbox是否选中, 根目录\单一文件必须选中
        length: 0,             // 文件\目录大小, 文件可直接获取此属性, 目录则需要递归计算 
    }
    // files不存在即为单文件种子
    if (bt.info.files === undefined) {
        root.length = bt.info.length  // 文件大小(字节)
        return root
    }
    // 否则为多文件种子, 添加根目录所需的属性
    root.children = []       // 目录下的子目录和文件
    root.pathName = new Map  // 目录下的 目录名=>children[]索引 哈希表, 目录树创建完毕时删除此属性

    let index = -1
    bt.info.files.forEach((file) => {
        index++
        let pathList = file['path.utf-8'] || file['path']          // 目录列表, 优先使用UTF-8编码
        let dir = getDir(root, pathList.slice(0, -1))              // 获取文件所属路径, 去除path的最后一项
        let fileName = decoder.decode(pathList[pathList.length-1]) // path的最后一项是文件名
        if (isPaddingFile(fileName)) {
            return  // 跳过占位文件
        }
        if (dir.btIndex) {
            dir.btIndex.push(index)
        }
        if (!dir.id) {
            dir.id = id++
        }
        // 文件
        dir.children.push({
            id: id++,
            parent: dir,                 // 父目录
            name: fileName,              // 新文件名, 修改时以此为准
            originName: fileName,        // 原始文件名
            length: file.length,         // 文件大小(字节)
            index: dir.children.length,  // 文件\目录在其父目录中的索引
            btIndex: index,              // btData.info.files[]的索引, 在文件中是整数形式
            checked: false,              // 默认不选中
        })
    })
    setDirLength(root)  // 计算目录的大小
    return root
}

/**
 * 获取文件所属目录, 路径不存在则递归创建
 * @param {Object} root 根目录
 * @param {Array<String>} pathList 路径数组
 * @returns {Object} 所属目录
 */
function getDir(root, pathList) {
    let depth = 0
    pathList.forEach((pathName) => {
        pathName = decoder.decode(pathName)
        if (!root.pathName.has(pathName)) {
            root.children.push({
                parent: root,                 // 父目录
                name: pathName,               // 目录名
                originName: pathName,         // 原目录名
                length: 0,                    // 目录大小, 加载完文件列表后再递归计算
                children: [],                 // 目录下的子目录和文件
                pathName: new Map,            // 目录下的 目录名=>children[]索引 哈希表, 目录树创建完毕时删除此属性
                checked: false,               // 关联视图的checkbox, 默认不选中
                depth: depth++,               // btData.info.files[].path[]索引, 只有目录拥有此属性
                btIndex: [],                  // btData.info.files[]的索引, 在目录中是数组形式
                index: root.children.length,  // 文件\目录在其父目录中的索引
            })
            root.pathName.set(pathName, root.children.length-1)
        }
        root = root.children[root.pathName.get(pathName)]  // 进入子目录
    })
    return root
}

/**
 * 修改所有文件(不包含目录)的checked属性为真
 * @param {Object} root 要修改的对象
 * @param {Boolean} invert 是否反选
 */
function check (root, invert=false) {
    if (root.children) {
        root.children.forEach((child) => check(child, invert))
    } else if (root.checked !== undefined) {
        if (invert) {
            root.checked = !root.checked
        } else {
            root.checked = true
        }
    }
}

/**
 * 文件是否是占位文件
 * @param {String} filename 文件名
 * @returns {Boolean}
 */
function isPaddingFile(filename) {
    return /^_____padding_file_\d+_/.test(filename)
}

/**
 * 将文件转换为占位文件
 * @param {String} filename 文件名
 * @param {Number} id 
 */
function convertToPaddingFile(filename, id=0) {
    return '_____padding_file_'+id+'_'+filename+'____'
}

/**
 * 将文件大小转化为人类友好的字符串
 * @param {Number} length 文件长度(字节)
 * @returns {String} 文件长度字符串
 */
function convertLength(length) {
    let suffix = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB', 'BB', 'NB', 'DB', 'CB']
    let i = 0
    for (; length >= 1024 && i < suffix.length; i++) {
        length /= 1024
    }
    length = Math.round(length*100) / 100  // 保留两位小数
    length = length + ' ' + suffix[i]      // 添加后缀
    return length
}

/**
 * 递归计算目录大小, 同时删除当前目录下的pathName
 * @param {Object} root 根目录
 * @returns {Number} 目录大小
 */
function setDirLength(root) {
    if (root.children) {
        delete root.pathName  // 删除不再需要的pathName
        root.children.forEach((child) => root.length += setDirLength(child))
    }
    return root.length
}

/**
 * 将文件\目录从btData中删除
 * @param {Object} file 要删除的文件\目录
 */
function deleteFile(file) {
    let isPath = file.btIndex instanceof Array
    if (!isPath) {
        // 删除的是文件
        // 将文件从btData中删除, 必须使用undefined判断可能为0的索引变量
        let arr = btData.info.files[file.btIndex]
        arr = arr['path.utf-8'] || arr['path']
        arr.splice(0, arr.length-1)
        arr[0] = convertToPaddingFile('deleted_by_sdjdd')
        let temp = file, length = file.length
        while (temp.parent) {
            temp.parent.length -= length
            temp = temp.parent
        }
    } else if (file.children.length > 0) {
        // 删除的是非空目录
        while (file.children.length > 0) {
            // 倒序删除以避免不必要的索引更新
            deleteFile(file.children[file.children.length-1])
        }
        return
    }
    let parent = file.parent
    let pIndex = file.index
    parent.children.splice(pIndex, 1)
    if (parent.children.length === 0 && parent.parent) {
        // 从祖父目录中将空的父目录删除
        deleteFile(parent)
        return
    }
    // 更新兄弟文件的索引
    for (; pIndex < parent.children.length; pIndex++) {
        parent.children[pIndex].index -= 1 
    }
}

/**
 * 获取所有选中的文件(不包含目录)
 * @param {Object} root 根目录
 * @param {Array} list 保存数据的数组
 */
function getCheckedList(root, list) {
    if (root.children) {
        root.children.forEach((child) => getCheckedList(child, list))
    } else if (root.checked) {
        list.push(root)
    }
}

/**
 * 将更改应用到btData
 * @param {Object} root 
 */
function saveChange(root) {
    if (!root.parent && root.name !== root.originName) {
        // 根目录情况
        if (btData.info['name.utf-8']) {
            btData.info['name.utf-8'] = root.name
        } else {
            btData.info['name'] = root.name
        }
        if (root.children) {
            root.children.forEach((child) => saveChange(child))
        }
        return
    }
    if (root.children) {
        // 目录情况
        if (root.name !== root.originName) {
            // 仅当目录名变化时进行重命名
            renamePath(root)
        }
        // 递归重命名目录
        root.children.forEach((child) => saveChange(child))
    } else if (root.name !== root.originName) {
        // 文件情况
        renameFile(root)
    }
}

/**
 * 重命名文件
 * @param {Object} file 文件对象
 */
function renameFile(file) {
    let arr = btData.info.files[file.btIndex]['path.utf-8'] || btData.info.files[file.btIndex]['path']
    arr[arr.length-1] = file.name
}

/**
 * 重命名目录
 * @param {Object} path 目录对象
 */
function renamePath(path) {
    path.btIndex.forEach((index) => {
        let file = btData.info.files[index]
        let arr = file['path.utf-8'] || file['path']
        arr[path.depth] = path.name
    })
}