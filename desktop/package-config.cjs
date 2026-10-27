const manifest=require('../build-manifest.json');
const mode = process.env.SPARK_PACKAGE_MODE || 'game';
const base = { appId: `org.dingdingprojects.sparkfoundry.${mode}`, productName: mode === 'builder' ? 'Spark Foundry Builder' : mode === 'guide' ? 'Spark Foundry Guide' : 'Spark Foundry', asar: true, electronDist: 'node_modules/electron/dist', directories: { output: manifest.outputs[mode] }, files: ['dist/**', 'desktop/**', 'package.json', 'build-manifest.json'], extraMetadata: { main: mode === 'builder' ? 'desktop/builder-main.cjs' : 'desktop/main.cjs', sparkMode: mode }, win: { icon: 'desktop/icon.ico', target: mode === 'game' ? ['squirrel'] : ['portable'], signAndEditExecutable: false }, publish: null };
if (mode === 'game') base.squirrelWindows = { name: 'spark_foundry', msi: false, iconUrl: 'https://raw.githubusercontent.com/Ding-Ding-Projects/spark-foundry/main/desktop/icon.ico', artifactName: 'SparkFoundrySetup.exe' };
else base.portable = { artifactName: mode === 'builder' ? 'SparkFoundryBuilder-${version}.exe' : 'SparkFoundryGuide-${version}.exe' };
module.exports = base;
