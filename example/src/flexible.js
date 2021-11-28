(function flexible(window, document) {
  var docEl = document.documentElement
  var dpr = window.devicePixelRatio || 1
  var isPc = docEl.clientWidth > 768
  var rem = 10

  // mobile: set 1rem = viewWidth / 37.5
  function setRemUnit() {
    if (!isPc) {
      rem = docEl.clientWidth / 37.5
    }
    docEl.style.fontSize = rem + 'px'
  }

  // adjust body font size: 1.4rem
  function setBodyFontSize() {
    if (document.body) {
      document.body.style.fontSize = (1.4 * rem * dpr) + 'px'
    } else {
      document.addEventListener('DOMContentLoaded', setBodyFontSize)
    }
  }

  function setRem() {
    setRemUnit()
    setBodyFontSize()
  }

  setRem()

  // reset rem unit on page resize
  window.addEventListener('resize', setRem)
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) {
      setRem()
    }
  })

  // detect 0.5px supports
  if (dpr >= 2) {
    var fakeBody = document.createElement('body')
    var testElement = document.createElement('div')
    testElement.style.border = '.5px solid transparent'
    fakeBody.appendChild(testElement)
    docEl.appendChild(fakeBody)
    if (testElement.offsetHeight === 1) {
      docEl.classList.add('hairlines')
    }
    docEl.removeChild(fakeBody)
  }
}(window, document))
