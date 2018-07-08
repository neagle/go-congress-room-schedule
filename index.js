const argv = require('yargs').argv
const fs = require('fs')
const parse = require('csv-parse/lib/sync')
const rimraf = require('rimraf')
const mkdirp = require('mkdirp')
const slugify = require('slugify')
const pdfMake = require('pdfMake')
const { format } = require('date-fns')
const cliSpinners = require('cli-spinners')
const ora = require('ora')
const chalk = require('chalk')

if (!argv.csv) {
  console.log('Please specify a `csv` file.')
  return
}

function folderify(date) {
  return date.replace(/\//g, '-')
}

let csv

try {
  csv = fs.readFileSync(argv.csv, 'utf8')
} catch (e) {
  console.error(e)
}

const data = parse(csv, { columns: true })

const days = {}
let pdfsToCreate = 0

data.forEach(event => {
  if (!days[event.Date]) {
    days[event.Date] = []
  }

  if (!days[event.Date][event.Location]) {
    days[event.Date][event.Location] = []
  }

  days[event.Date][event.Location].push(event)
})

rimraf.sync('./build')

Object.entries(days).forEach(([date, locations]) => {
  const dayFolder = `./build/${folderify(date)}`
  mkdirp.sync(dayFolder)

  Object.entries(locations).forEach(([location, events]) => {
    events.sort((a, b) => {
      const aStart = new Date(`${date} ${a['Start Time']}`)
      const bStart = new Date(`${date} ${b['Start Time']}`)

      return aStart - bStart
    })

    const docDefinition = {
      defaultStyle: {
        font: 'Boswell'
      },
      content: [
        {
          image: 'images/go-congress-2018-logo-2328x2190.png',
          width: 150,
          alignment: 'center',
          margin: [0, 0, 0, 10]
        },
        {
          text: `${location} - ${format(date, 'dddd, MMMM Mo')}`,
          style: 'header'
        }
      ],

      styles: {
        header: {
          fontSize: 30,
          alignment: 'center',
          margin: [0, 0, 0, 10]
        },
        time: {
          font: 'Webster',
          fontSize: 14,
          alignment: 'right',
          margin: [0, 14, 0, 0]
        },
        title: {
          font: 'Boswell',
          fontSize: 18,
          margin: [0, 10, 0, 0]
        },
        description: {
          font: 'CormorantGaramond',
          fontSize: 14
        },
        ornament: {
          font: 'ColonialBullets',
          fontSize: 36,
          alignment: 'center',
          margin: [0, 30, 0, 0]
        }
      }
    }

    const timeColumnWidth = '30%'

    // Keep track of descriptions we've used -- if we have multiple events
    // using the same description, we only want to put it on our sign the
    // first time
    const descriptions = []

    events.forEach(event => {
      const startTime = event['Start Time'].toLowerCase()
      const endTime = event['End Time'].toLowerCase()
      const title = event.Title
      const description = event.Description

      docDefinition.content.push({
        columns: [
          {
            width: timeColumnWidth,
            text: `${startTime} - ${endTime}`,
            style: 'time'
          },
          {
            width: '*',
            text: title,
            style: 'title'
          }
        ],
        columnGap: 10
      })

      if (description && descriptions.indexOf(description) === -1) {
        descriptions.push(description)

        docDefinition.content.push({
          columns: [
            {
              width: timeColumnWidth,
              text: ''
            },
            {
              width: '*',
              text: description,
              style: 'description'
            }
          ],
          columnGap: 10
        })
      }
    })

    const possibleOrnaments = 'rtvz034jgiaWYNSOGDEZoP'
    const ornament = possibleOrnaments.split('')[
      Math.floor(Math.random() * possibleOrnaments.length)
    ]

    docDefinition.content.push({
      text: ornament,
      style: 'ornament'
    })

    const fonts = {
      Boswell: {
        normal: 'fonts/Boswell.ttf'
      },
      ColonialBullets: {
        normal: 'fonts/ColonialBulletsWF.ttf'
      },
      Webster: {
        normal: 'fonts/WebsterRomanWF.ttf',
        italic: 'fonts/WebsterItalicWF.ttf'
      },
      CormorantGaramond: {
        normal: 'fonts/cormorant-garamond/CormorantGaramond-Regular.ttf',
        bold: 'fonts/cormorant-garamond/CormorantGaramond-Bold.ttf',
        italic: 'fonts/cormorant-garamond/CormorantGaramond-Italic.ttf'
      }
    }

    const printer = new pdfMake(fonts)

    const pdfDoc = printer.createPdfKitDocument(docDefinition)
    const filename = `${dayFolder}/${folderify(location)}.pdf`
    console.log(chalk.cyan(`Creating ${filename}`))

    pdfsToCreate += 1
    pdfDoc.pipe(fs.createWriteStream(filename))
    pdfDoc.end()

    pdfDoc.on('end', () => {
      pdfsToCreate -= 1
      if (pdfsToCreate === 0) {
        spinner.succeed()
      }
    })
  })
})

const spinner = ora({
  text: 'Building PDFs…',
  spinner: cliSpinners.squareCorners
}).start()
