const express = require("express");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const app = express();
const PORT = 3000;


/* ==========================================
   SERVIR LOS ARCHIVOS DEL FRONTEND
========================================== */

app.use(express.static("public"));


/* ==========================================
   CONEXIÓN CON SUPABASE
========================================== */

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);


/* ==========================================
   PÁGINA PRINCIPAL
========================================== */

app.get("/", (req, res) => {

    res.sendFile(
        __dirname + "/public/index.html"
    );

});


/* ==========================================
   PRUEBA DE CONEXIÓN CON SUPABASE
========================================== */

app.get("/prueba-supabase", async (req, res) => {

    const { data, error } = await supabase
        .from("alumnos")
        .select("*");


    if (error) {

        return res.status(500).send(
            "Error conectando con Supabase: " +
            error.message
        );

    }


    res.json({

        mensaje:
            "Conexión con Supabase funcionando correctamente",

        alumnos: data

    });

});


/* ==========================================
   API - CONSULTAR CUENTA POR DNI
========================================== */

app.get("/api/cuenta/:dni", async (req, res) => {

    const dni = req.params.dni;


    /* --------------------------------------
       VALIDAR DNI
    -------------------------------------- */

    if (!/^\d{7,8}$/.test(dni)) {

        return res.status(400).json({

            error:
                "DNI inválido. Debe contener 7 u 8 números."

        });

    }


    /* --------------------------------------
       BUSCAR ALUMNO
    -------------------------------------- */

    const {
        data: alumno,
        error: errorAlumno
    } = await supabase

        .from("alumnos")

        .select("*")

        .eq("dni", dni)

        .maybeSingle();


    /* --------------------------------------
       ERROR AL BUSCAR ALUMNO
    -------------------------------------- */

    if (errorAlumno) {

        console.error(
            "Error buscando alumno:",
            errorAlumno
        );

        return res.status(500).json({

            error:
                errorAlumno.message

        });

    }


    /* --------------------------------------
       ALUMNO NO ENCONTRADO
    -------------------------------------- */

    if (!alumno) {

        return res.status(404).json({

            error:
                "Alumno no encontrado."

        });

    }


    /* --------------------------------------
       BUSCAR CUOTAS DEL ALUMNO
    -------------------------------------- */

    const {
        data: cuotas,
        error: errorCuotas
    } = await supabase

        .from("cuotas")

        .select("*")

        .eq(
            "alumno_id",
            alumno.id
        )

        .order(
            "vencimiento",
            {
                ascending: true
            }
        );


    /* --------------------------------------
       ERROR AL BUSCAR CUOTAS
    -------------------------------------- */

    if (errorCuotas) {

        console.error(
            "Error buscando cuotas:",
            errorCuotas
        );

        return res.status(500).json({

            error:
                "Error al consultar las cuotas."

        });

    }


    /* --------------------------------------
       CALCULAR SALDO PENDIENTE
    -------------------------------------- */

    const saldo = cuotas

        .filter(
            cuota =>
                !cuota.pagado
        )

        .reduce(

            (total, cuota) => {

                return total +
                    Number(
                        cuota["cuota.importe"]
                    );

            },

            0

        );


    /* --------------------------------------
       DEVOLVER INFORMACIÓN
    -------------------------------------- */

    res.json({

        alumno: alumno,

        cuotas: cuotas,

        saldo: saldo

    });

});


/* ==========================================
   INICIAR SERVIDOR
========================================== */

app.listen(
    PORT,
    () => {

        console.log(
            `Servidor iniciado en http://localhost:${PORT}`
        );

    }
);