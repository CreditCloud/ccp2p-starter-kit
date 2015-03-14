CCP2P Starter Kit
=================

( 下载地址: http://pan.baidu.com/s/1dD4bqAt )

这是用于开始 CreditCloud P2P 项目前端重构工作的静态文件服务器。

开发时请遵循[《CreditCloud 代码风格指导》][cg]。

`server/` 文件夹下包含一个简单的静态文件服务器，用于即时编译 less 文件和处理 `_layout.html` 文件。工作内容放到 `work/` 目录下。请参考代码风格指导放置不同类型的文件：

> 静态文件均放在 /assets 目录下，CSS/Less 文件放在 /assets/css 下，JS 文件放在 /assets/js 下，图片文件放在 /assets/img 下。

`server/` 文件夹已经包含了所需要的全部代码和第三方库，主要为方便 Windows 开发者，已经包含了 node.js 运行程序，只要双击 `Windows启动脚本.bat` 即可启动。Linux/Mac 用户自行安装 node.js 后在项目根目录（包含 `server/` 和 `work/` 的目录）或 `server/` 目录内运行 `npm start` 即可。

less 即时编译
-------------

如访问 `http://localhost:4000/assets/css/home.css` 会输出 `work/assets/css/home.less` 这个 less 文件即时编译后的 css，如果不存在 home.less 文件，则会尝试直接返回 home.css 这个文件。

base.css 包含了基础的 css 框架，因为极少需要改动（也不建议改动），为了提高开发效率，只在第一次访问时对 base.less 做编译，之后都会输出这次编译结果，所以如果需要改动 base.less 或 variables.less，在改动后需要重启 server。

html
----

HTML 文件扩展名用 `.html` 而不用 `.htm`，对应访问的路径如 `http://localhost:4000/loan/list` 会返回相应的目录下的文件 `work/loan/list.html`。

如果存在 `work/_layout.html` 这个文件，就会都输出这个文件的内容，然后把它里面的 id="main-container" 的 div 内容填入相应的 html 文件内容。因为我们的产品几乎所有页面的头部底部都是相同的只在中间主要内容部分不同，所以在 _layout.html 文件内写 header 和 footer 等共用部分，在其他文件中写中间不同的部分。

如果没有 _layout.html 文件，输出的页面就照源文件不做任何改变，如果在使用 layout 的时候对某些页面需要禁用掉 layout，在访问地址后面添加 ?nolayout 即可。

页面内链接做成可点击的以 `/` 开头的绝对路径。

mediaqueries 在 IE8 下的处理
----------------------------

一般不需要做 responsive 设计，但是 Bootstrap 和 Pure.css 框架会有一些使用 mediaquery 的代码。为了在 IE8 下表现正常，我们的处理方式是根据 user-agent 判断，对 IE8 响应的 css 按照宽度为 1024px 的规则自动地去掉 @media 规则区块。

javascript
----------

一般不需要在页面重构阶段使用 javascript，对于需要做多个状态的组建，遵循代码风格指导用添加 `__xxx` 后缀方式的 class 名，然后对于带 `__xxx` 后缀样式，提交时加上 `display: none` 隐藏掉（可以通过开发者工具调整后看到）即可。

最后提交 `work/` 文件夹的打包即可

[cg]: https://github.com/CreditCloud/styleguide "CreditCloud 代码风格指导"
