
try {
  // https://caniuse.com/mdn-javascript_regular_expressions_named_capturing_group_duplicate_named_capturing_groups
  RegExp('(?<$>)|(?<$>)')
} catch (_error) {
  (function () {
    try {
      document.addEventListener('DOMContentLoaded', T)
    } catch (e) {
      document.attachEvent('onreadystatechange', function (e) {
        if (document.readyState === 'complete') { T(e) }
      })
    }
    function T(event) {
      var success = false, error = _error, html = ''
      try {
        var tagName = 'metadata-fetcher'
        var El = customElements.get(tagName)
        var el = document.getElementsByTagName(tagName)[0]
        success = el instanceof El
      } catch (e) { error = e }
      var icon = success
        ? '<i class="ivu-icon ivu-icon-ios-close-circle"></i>'
        : '<img style="height:16px" src="./.favicon">'
      var msg = '当前浏览器版本' + (success ? '较' : '过') + '低！'
      html += '<span class="ivu-alert-icon">' + icon + '</span>'
      html += '<span class="ivu-alert-message">' + msg + '</span>'
      var div = document.createElement('div'), body = document.body
      div.className = 'ivu-alert ivu-alert-error ivu-alert-with-icon'
      div.innerHTML = html
      body.insertBefore(div, body.firstChild)
      throw error
    }
  })()
}
